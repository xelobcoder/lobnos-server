"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { installerVerifier } = require("./installation-verifier.cjs");
const desktop = path.resolve(__dirname, "..", "..", "..", "lobnos");

test("installer verifier accepts the configured password and rejects another without retaining plaintext", () => {
	const password = crypto.randomBytes(24).toString("hex");
	const verifier = installerVerifier(password);
	const derive = candidate => crypto.pbkdf2Sync(candidate, Buffer.from(verifier.salt, "base64"),
		verifier.iterations, 32, "sha256");
	assert.equal(crypto.timingSafeEqual(derive(password), Buffer.from(verifier.hash, "base64")), true);
	assert.equal(crypto.timingSafeEqual(derive("incorrect-password"), Buffer.from(verifier.hash, "base64")), false);
	assert.equal(JSON.stringify(verifier).includes(password), false);
});

test("NSIS checks authorization in customInit before the installation section and refuses silent bypass", () => {
	const hook = fs.readFileSync(path.join(desktop, "desktop", "installer", "password-gate.nsh"), "utf8");
	assert.match(hook, /!macro customInit/);
	assert.match(hook, /IfSilent pls_install_denied/);
	assert.match(hook, /StrCmp \$0 "0" pls_install_authorized/);
	assert.match(hook, /SetErrorLevel 1\s+Quit/);
	assert.doesNotMatch(hook, /password\s+.*\$[0-9]/i);
	const yaml = fs.readFileSync(path.join(desktop, "electron-builder.yml"), "utf8");
	assert.match(yaml, /include: desktop\/installer\/password-gate\.nsh/);
});

test("password stays in the masked dialog, never an argument or persisted input file", () => {
	const helper = fs.readFileSync(path.join(desktop, "desktop", "installer", "password-gate.ps1"), "utf8");
	assert.match(helper, /UseSystemPasswordChar = \$true/);
	assert.match(helper, /Rfc2898DeriveBytes/);
	assert.doesNotMatch(helper, /Write-(Host|Output)|Set-Content|Out-File|Start-Process/);
});
