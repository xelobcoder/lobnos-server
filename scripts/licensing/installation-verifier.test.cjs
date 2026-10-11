"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { installationVerifier, maskedPrompt, failureMessage, main } = require("./installation-verifier.cjs");
const { verifyPassword } = require("../../../lobnos/desktop/setup-auth.cjs");

test("external admin configuration saves only a salted verifier and reuses it without prompting", async t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pls-verifier-fixture-"));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	const password = "fixture-installation-only";
	const value = await installationVerifier(directory, { prompt: async () => password });
	assert.equal(verifyPassword(password, value), true);
	const disk = fs.readFileSync(path.join(directory, "installation-verifier.json"), "utf8");
	assert.equal(disk.includes(password), false);
	assert.equal(await installationVerifier(directory, { prompt: () => assert.fail("must reuse") }), value);
});
test("noninteractive/mismatching configuration fails closed without writing a verifier", async t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pls-verifier-fail-"));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	await assert.rejects(maskedPrompt("ignored", { isTTY: false }, { isTTY: false }), /masked interactive terminal/);
	let count = 0;
	await assert.rejects(installationVerifier(directory, { prompt: async () => ++count === 1 ? "fixture-installation-only" : "different" }), /do not match/);
	assert.equal(fs.existsSync(path.join(directory, "installation-verifier.json")), false);
	await assert.rejects(main(["--password", "never-accepted"]), /Never supply passwords/);
});

test("short passwords fail before confirmation and preserve existing verifier files", async t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pls-verifier-short-"));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	const file = path.join(directory, "installation-verifier.json");
	fs.writeFileSync(file, "existing-verifier");
	let prompts = 0;
	await assert.rejects(installationVerifier(directory, {
		configure: true, prompt: async () => { prompts++; return "abcd"; },
	}), /12 to 256 characters/);
	assert.equal(prompts, 1);
	assert.equal(fs.readFileSync(file, "utf8"), "existing-verifier");
	assert.equal(fs.existsSync(path.join(directory, "installer-verifier.json")), false);
});

test("failure messages distinguish validation and permissions without echoing unknown input", () => {
	const short = new Error("Use an installation password of 12 to 256 characters.");
	assert.equal(failureMessage(short), short.message);
	const mismatch = new Error("Installation passwords do not match. No verifier was saved.");
	assert.equal(failureMessage(mismatch), mismatch.message);
	assert.match(failureMessage({ code: "EACCES" }), /permissions/);
	for (const message of [
		"Could not determine the current Windows security identifier.",
		"Could not restrict issuer key permissions to the current user and administrators.",
	]) {
		assert.equal(failureMessage(new Error(message)), message);
	}
	assert.equal(failureMessage(new Error("secret-input-not-for-output")).includes("secret-input"), false);
});
