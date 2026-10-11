#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createVerifier, parseVerifier } = require("../../../lobnos/desktop/setup-auth.cjs");
const FILENAME = "installation-verifier.json";
function installerVerifier(password) {
	const crypto = require("node:crypto");
	const salt = crypto.randomBytes(32);
	return { version: 1, algorithm: "pbkdf2-sha256", iterations: 600000,
		salt: salt.toString("base64"),
		hash: crypto.pbkdf2Sync(password, salt, 600000, 32, "sha256").toString("base64") };
}

/** No CLI/environment password option. Raw TTY input is masked and never echoed. */
function maskedPrompt(label, input = process.stdin, output = process.stdout) {
	if (!input.isTTY || !output.isTTY || !input.setRawMode) {
		return Promise.reject(new Error("A masked interactive terminal is required to configure the installation verifier. Run desktop:configure-install-password on the release workstation."));
	}
	return new Promise((resolve, reject) => {
		let password = "";
		const wasRaw = Boolean(input.isRaw);
		const finish = (error) => {
			input.removeListener("data", onData);
			input.setRawMode(wasRaw);
			input.pause();
			output.write("\n");
			if (error) reject(error); else resolve(password);
			password = "";
		};
		const onData = chunk => {
			for (const char of chunk.toString("utf8")) {
				if (char === "\u0003") { finish(new Error("Installation verifier configuration canceled.")); return; }
				if (char === "\r" || char === "\n") { finish(); return; }
				if (char === "\u007f" || char === "\b") {
					if (password) { password = password.slice(0, -1); output.write("\b \b"); }
				} else if (char >= " " && char !== "\u001b") {
					password += char;
					if (password.length > 256) { finish(new Error("Installation password is too long.")); return; }
					output.write("*");
				}
			}
		};
		output.write(label);
		input.setRawMode(true);
		input.resume();
		input.on("data", onData);
	});
}
async function installationVerifier(directory, { configure = false, prompt = maskedPrompt, secure = () => {} } = {}) {
	const file = path.join(directory, FILENAME);
	if (!configure && fs.existsSync(file)) {
		try {
			const config = JSON.parse(fs.readFileSync(file, "utf8"));
			if (config.version !== 1) throw new Error();
			parseVerifier(config.verifier);
			if (!fs.existsSync(path.join(directory, "installer-verifier.json"))) {
				throw new Error("Installer verifier must be configured.");
			}
			return config.verifier;
		} catch { throw new Error("External installation verifier is invalid. Restore it or explicitly reconfigure it before building."); }
	}
	const password = await prompt("New installation authorization password (12–256 characters): ");
	if (typeof password !== "string" || password.length < 12 || password.length > 256 || /[\r\n\0]/.test(password)) {
		throw new Error("Use an installation password of 12 to 256 characters.");
	}
	const confirmation = await prompt("Confirm installation authorization password: ");
	if (password !== confirmation) throw new Error("Installation passwords do not match. No verifier was saved.");
	const verifier = createVerifier(password);
	const windowsVerifier = installerVerifier(password);
	fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
	const temporary = `${file}.${process.pid}.tmp`;
	try {
		fs.writeFileSync(temporary, JSON.stringify({ version: 1, verifier }) + "\n", { flag: "wx", mode: 0o600 });
		secure(temporary);
		fs.renameSync(temporary, file);
		secure(file);
		const installerFile = path.join(directory, "installer-verifier.json");
		fs.writeFileSync(installerFile, JSON.stringify(windowsVerifier), { mode: 0o600 });
		secure(installerFile);
	} finally { try { fs.unlinkSync(temporary); } catch {} }
	return verifier;
}
async function main(argv = process.argv.slice(2)) {
	if (argv.length && (argv.length !== 2 || argv[0] !== "--directory")) throw new Error("Only --directory is supported. Never supply passwords as arguments.");
	const { externalKeyDirectory, getWindowsSid, setWindowsAcl } = require("./build-desktop.cjs");
	const directory = externalKeyDirectory(argv[1] || process.env.PLS_ISSUER_KEY_DIR ||
		path.join(process.env.LOCALAPPDATA || "", "PLS-Licensing", "issuer"));
	const sid = process.platform === "win32" ? getWindowsSid() : undefined;
	await installationVerifier(directory, { configure: true, secure: file => {
		if (process.platform === "win32") {
			setWindowsAcl(file, false, sid);
		} else fs.chmodSync(file, 0o600);
	} });
	process.stdout.write("External scrypt installation verifier configured. No plaintext password was saved.\n");
}
function failureMessage(error) {
	const reviewed = [
		"Use an installation password of 12 to 256 characters.",
		"Installation passwords do not match. No verifier was saved.",
		"Installation verifier configuration canceled.",
		"Installation password is too long.",
		"Cannot determine Windows identity.",
		"Could not determine the current Windows security identifier.",
		"Windows system directory is unavailable; run the command in a regular PowerShell terminal.",
		"Could not restrict issuer key permissions to the current user and administrators.",
		"Only --directory is supported. Never supply passwords as arguments.",
		"A masked interactive terminal is required to configure the installation verifier. Run desktop:configure-install-password on the release workstation.",
	];
	if (error && reviewed.includes(error.message)) return error.message;
	if (error && ["EACCES", "EPERM", "EROFS"].includes(error.code)) {
		return "Cannot save the verifier. Check permissions on the external issuer directory and whether it is read-only.";
	}
	return "Could not save or secure the verifier. Check the external issuer directory and Windows access permissions. Run the command in a regular PowerShell terminal if Git Bash cannot provide a masked terminal.";
}
if (require.main === module) main().catch(error => {
	process.stderr.write(`Installation verifier configuration failed: ${failureMessage(error)}\n`);
	process.exitCode = 1;
});
module.exports = { maskedPrompt, installationVerifier, installerVerifier, failureMessage, main };
