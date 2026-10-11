"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { parseDuration, validityForDays, run } = require("./sign-request.cjs");

test("duration accepts day and week quantities", () => {
	assert.equal(parseDuration("14 days"), 14);
	assert.equal(parseDuration("1d"), 1);
	assert.equal(parseDuration("3 weeks"), 21);
	assert.throws(() => parseDuration("0 weeks"), /positive duration/);
	assert.throws(() => parseDuration("a month"), /positive duration/);
});

test("validity starts at the current UTC day and includes the full requested duration", () => {
	assert.deepEqual(validityForDays(2, new Date("2026-10-11T22:39:00.000Z")), {
		startsAt: "2026-10-11T00:00:00.000Z",
		endsAt: "2026-10-12T23:59:59.999Z",
	});
});

test("interactive request signing derives dates and a unique output path", async t => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pls-license-sign-"));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	const requestPath = path.join(directory, "request.json");
	fs.writeFileSync(requestPath, JSON.stringify({ tenantId: 990556 }));
	const invocations = [];
	const output = [];
	const prompts = [];

	const result = await run(["--request", requestPath], {
		now: new Date("2026-10-11T22:39:00.000Z"),
		io: { stdin: { isTTY: true }, stdout: { write: value => output.push(value) } },
		prompt: async question => {
			prompts.push(question);
			return "3 weeks";
		},
		spawnSync: (_executable, args, options) => {
			invocations.push({ args, options });
			return { status: 0 };
		},
	});

	assert.deepEqual(prompts, ["License duration from today (for example, 14 days or 3 weeks): "]);
	assert.equal(result.durationDays, 21);
	assert.equal(result.startsAt, "2026-10-11T00:00:00.000Z");
	assert.equal(result.endsAt, "2026-10-31T23:59:59.999Z");
	assert.match(result.outputPath, /PLS-signed-certificate-990556-[0-9a-f-]{36}\.json$/);
	assert.equal(invocations.length, 1);
	assert.equal(invocations[0].options.shell, false);
	const args = invocations[0].args;
	assert.equal(args[args.indexOf("--request") + 1], requestPath);
	assert.equal(args[args.indexOf("--starts-at") + 1], result.startsAt);
	assert.equal(args[args.indexOf("--ends-at") + 1], result.endsAt);
	assert.equal(args[args.indexOf("--grace-days") + 1], "0");
	assert.match(output.join(""), /Valid from 2026-10-11T00:00:00\.000Z through 2026-10-31T23:59:59\.999Z/);
});

test("non-interactive signing requires explicit duration", async t => {
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pls-license-sign-"));
t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
const requestPath = path.join(directory, "request.json");
fs.writeFileSync(requestPath, JSON.stringify({ tenantId: 990556 }));
await assert.rejects(run(["--request", requestPath], {
	io: { stdin: { isTTY: false }, stdout: { write() {} } },
	spawnSync: () => ({ status: 0 }),
}), /Specify --days or --weeks/);
});
