#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { createInterface } = require("node:readline/promises");

const ISSUER_CLI = path.join(__dirname, "issuer.cjs");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDuration(value) {
	const match = /^([1-9]\d*)\s*(d|day|days|w|week|weeks)$/i.exec(value.trim());
	if (!match) throw new Error("Enter a positive duration such as 14 days or 3 weeks.");
	const amount = Number(match[1]);
	const days = amount * (/^(w|week|weeks)$/i.test(match[2]) ? 7 : 1);
	if (!Number.isSafeInteger(days)) throw new Error("The requested duration is too large.");
	return days;
}

function nonnegativeInteger(value, option, maximum) {
	if (!/^(0|[1-9]\d*)$/.test(value || "")) throw new Error(`${option} must be a whole number from 0 to ${maximum}.`);
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new Error(`${option} must be a whole number from 0 to ${maximum}.`);
	return parsed;
}

function validityForDays(days, now = new Date()) {
	if (!Number.isSafeInteger(days) || days < 1) {
		throw new Error("License duration must be a positive whole number of days.");
	}
	const starts = new Date(now);
	starts.setUTCHours(0, 0, 0, 0);
	const ends = new Date(starts.getTime() + days * MS_PER_DAY - 1);
	if (!Number.isFinite(ends.getTime())) throw new Error("The requested duration is too large.");
	return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

function parseArguments(argv) {
	const options = {};
	const allowed = new Set(["--request", "--output", "--days", "--weeks", "--grace-days", "--license-id", "--private-key"]);
	for (let index = 0; index < argv.length; index += 2) {
		const key = argv[index];
		const value = argv[index + 1];
		if (!allowed.has(key) || !value || value.startsWith("--") || options[key] !== undefined) {
			throw new Error("Invalid arguments. Run with --request, --days, or --weeks options as needed.");
		}
		options[key] = value;
	}
	if (options["--days"] !== undefined && options["--weeks"] !== undefined) {
		throw new Error("Choose either --days or --weeks, not both.");
	}
	return options;
}

function positiveInteger(value, option, maximum = Number.MAX_SAFE_INTEGER) {
	if (!/^[1-9]\d*$/.test(value || "")) throw new Error(`${option} must be a positive whole number.`);
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed > maximum) throw new Error(`${option} is outside the supported range.`);
	return parsed;
}

async function run(argv, dependencies = {}) {
	const io = dependencies.io || process;
	const prompt = dependencies.prompt || promptForInput;
	const options = parseArguments(argv);
	let requestPath = path.resolve(options["--request"] || "PLS-activation-request.json");
	if (!fs.existsSync(requestPath)) {
		if (!io.stdin.isTTY) throw new Error(`Activation request not found: ${requestPath}`);
		requestPath = path.resolve(await prompt("Path to activation request JSON: "));
	}

	let durationDays;
	if (options["--days"] !== undefined) {
		durationDays = positiveInteger(options["--days"], "--days");
	} else if (options["--weeks"] !== undefined) {
		durationDays = positiveInteger(options["--weeks"], "--weeks") * 7;
		if (!Number.isSafeInteger(durationDays)) throw new Error("--weeks is outside the supported range.");
	} else {
		if (!io.stdin.isTTY) throw new Error("Specify --days or --weeks, or run this command in an interactive terminal.");
		durationDays = parseDuration(await prompt("License duration from today (for example, 14 days or 3 weeks): "));
	}

	if (fs.statSync(requestPath).size > 65536) throw new Error("Activation request exceeds the 64 KB limit.");
	const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
	if (!request || typeof request !== "object" || Array.isArray(request) ||
		!Number.isSafeInteger(request.tenantId) || request.tenantId <= 0) {
		throw new Error("Activation request has an invalid tenant ID.");
	}
	const now = dependencies.now || new Date();
	const validity = validityForDays(durationDays, now);
	const outputPath = path.resolve(options["--output"] ||
		path.join(path.dirname(requestPath), `PLS-signed-certificate-${request.tenantId}-${randomUUID()}.json`));
	const keyDirectory = process.env.PLS_ISSUER_KEY_DIR ||
		(process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "PLS-Licensing", "issuer"));
	if (!options["--private-key"] && !keyDirectory) {
		throw new Error("Issuer key directory is not configured; set PLS_ISSUER_KEY_DIR or use Windows LOCALAPPDATA.");
	}
	const privateKey = path.resolve(options["--private-key"] || path.join(keyDirectory, "issuer-private.pem"));
	const args = [
		ISSUER_CLI, "sign-request",
		"--private-key", privateKey,
		"--request", requestPath,
		"--output", outputPath,
		"--starts-at", validity.startsAt,
		"--ends-at", validity.endsAt,
		"--grace-days", options["--grace-days"] === undefined
			? "0" : String(nonnegativeInteger(options["--grace-days"], "--grace-days", 365)),
	];
	if (options["--license-id"]) args.push("--license-id", options["--license-id"]);
	const result = (dependencies.spawnSync || spawnSync)(process.execPath, args, {
		cwd: path.resolve(__dirname, "..", ".."),
		stdio: "inherit",
		shell: false,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`Signing failed with exit code ${result.status}.`);
	io.stdout.write(`Signed certificate created: ${outputPath}\nValid from ${validity.startsAt} through ${validity.endsAt} (UTC).\n`);
	return { outputPath, ...validity, durationDays };
}

async function promptForInput(question) {
	const readline = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return await readline.question(question);
	} finally {
		readline.close();
	}
}

if (require.main === module) {
	run(process.argv.slice(2)).catch(error => {
		console.error(error.message);
		process.exitCode = 1;
	});
}

module.exports = { parseDuration, validityForDays, parseArguments, run };
