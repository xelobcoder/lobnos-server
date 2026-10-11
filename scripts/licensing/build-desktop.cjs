#!/usr/bin/env node
"use strict";

// Release workstation only. Issuer private keys stay external to both repositories.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { parse } = require("dotenv");

const BACKEND_ROOT = path.resolve(__dirname, "..", "..");
const DESKTOP_ROOT = path.resolve(BACKEND_ROOT, "..", "lobnos");
const DESKTOP_CONFIG = path.join(DESKTOP_ROOT, "desktop", "config", "backend.env");
const PRIVATE_KEY_NAME = "issuer-private.pem";
const PUBLIC_KEY_NAME = "issuer-public.pem";
const LICENSE_CLI = path.join(BACKEND_ROOT, "dist", "src", "scripts", "license.js");

function positiveTenant(value) {
	if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
	const id = Number(value);
	return Number.isSafeInteger(id) ? id : null;
}

function parseArguments(argv) {
	if (argv[0] === "--") argv = argv.slice(1);
	const options = {};
	const flags = new Set(["--prepare-only", "--activate-local", "--facility-specific"]);
	const values = new Set([
		"--tenant-id", "--starts-at", "--ends-at", "--grace-days",
		"--license-id", "--local-storage-dir",
	]);
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (flags.has(arg)) {
			if (options[arg]) throw new Error("Duplicate option.");
			options[arg] = true;
			continue;
		}
		if (!values.has(arg) || !argv[i + 1] || argv[i + 1].startsWith("--") || options[arg] !== undefined) {
			throw new Error("Invalid build options.");
		}
		options[arg] = argv[++i];
	}
	if (options["--tenant-id"] && !positiveTenant(options["--tenant-id"])) {
		throw new Error("--tenant-id must be a positive safe integer.");
	}
	if (options["--grace-days"] !== undefined &&
		(!/^(0|[1-9]\d*)$/.test(options["--grace-days"]) ||
			Number(options["--grace-days"]) > 365)) {
		throw new Error("--grace-days must be an integer from 0 to 365.");
	}
	if (options["--prepare-only"] && options["--activate-local"]) {
		throw new Error("--prepare-only cannot be combined with --activate-local.");
	}
	if (options["--activate-local"]) {
		if (!options["--starts-at"] || !options["--ends-at"]) {
			throw new Error("--activate-local requires --starts-at and --ends-at in UTC ISO format.");
		}
		validateIsoArgument(options["--starts-at"], "--starts-at");
		validateIsoArgument(options["--ends-at"], "--ends-at");
		if (Date.parse(options["--starts-at"]) > Date.parse(options["--ends-at"])) {
			throw new Error("--starts-at must not be later than --ends-at.");
		}
		if (options["--license-id"] && !/^[A-Za-z0-9_-]{1,128}$/.test(options["--license-id"])) {
			throw new Error("--license-id contains unsupported characters.");
		}
		if (!options["--local-storage-dir"] && !process.env.PLS_LICENSE_STORAGE_DIR) {
			throw new Error("--activate-local requires --local-storage-dir or PLS_LICENSE_STORAGE_DIR.");
		}
	} else if (options["--starts-at"] || options["--ends-at"] || options["--grace-days"] ||
		options["--license-id"] || options["--local-storage-dir"]) {
		throw new Error("License terms and local storage options require --activate-local.");
	}
	return options;
}

function readEnv(filePath) {
	try {
		return parse(fs.readFileSync(filePath, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT") return {};
		throw new Error("Unable to read configuration file.");
	}
}

function inside(parent, candidate) {
	const relative = path.relative(path.resolve(parent), path.resolve(candidate));
	return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function externalKeyDirectory(directory) {
	if (!path.isAbsolute(directory)) throw new Error("Issuer key directory must be an absolute path.");
	const resolved = path.resolve(directory);
	if (inside(BACKEND_ROOT, resolved) || inside(DESKTOP_ROOT, resolved)) {
		throw new Error("Issuer keys must be stored outside both project directories.");
	}
	if (fs.existsSync(resolved)) {
		const stat = fs.lstatSync(resolved);
		if (stat.isSymbolicLink() || !stat.isDirectory() ||
			path.resolve(fs.realpathSync(resolved)) !== resolved) {
			throw new Error("Issuer key directory must be a real, non-linked directory.");
		}
	}
	return resolved;
}

function issuerDirectory(environment = process.env) {
	if (environment.PLS_ISSUER_KEY_DIR) {
		return externalKeyDirectory(environment.PLS_ISSUER_KEY_DIR);
	}
	if (!environment.LOCALAPPDATA || !path.isAbsolute(environment.LOCALAPPDATA)) {
		throw new Error("LOCALAPPDATA is unavailable; set PLS_ISSUER_KEY_DIR to an absolute external directory.");
	}
	return externalKeyDirectory(path.join(environment.LOCALAPPDATA, "PLS-Licensing", "issuer"));
}

function windowsSystemExecutable(name, environment = process.env) {
	const root = environment.SystemRoot || environment.WINDIR;
	if (!root || !path.win32.isAbsolute(root)) {
		throw new Error("Windows system directory is unavailable; run the command in a regular PowerShell terminal.");
	}
	return path.win32.join(root, "System32", name);
}

function getWindowsSid(dependencies = {}) {
	let output;
	try {
		output = (dependencies.execFileSync || execFileSync)(
			windowsSystemExecutable("whoami.exe", dependencies.environment),
			["/user", "/fo", "csv", "/nh"], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
				windowsHide: true,
				shell: false,
			});
	} catch (error) {
		throw new Error("Could not determine the current Windows security identifier.", { cause: error });
	}
	const match = output.match(/\bS-1-\d+(?:-\d+)+\b/);
	if (!match) throw new Error("Could not determine the current Windows security identifier.");
	return match[0];
}

function setWindowsAcl(target, directory, sid, dependencies = {}) {
	if (process.platform !== "win32") {
		throw new Error("Issuer key ACL setup is supported only on Windows.");
	}
	const args = [target, "/inheritance:r", "/grant:r"];
	if (directory) {
		args.push(`*${sid}:(OI)(CI)F`, "*S-1-5-32-544:(OI)(CI)F");
	} else {
		args.push(`*${sid}:F`, "*S-1-5-32-544:F");
	}
	const result = (dependencies.spawnSync || spawnSync)(
		windowsSystemExecutable("icacls.exe", dependencies.environment), args, {
		encoding: "utf8",
		stdio: ["ignore", "ignore", "ignore"],
		windowsHide: true,
		shell: false,
	});
	if (result.error || result.status !== 0) {
		throw new Error("Could not restrict issuer key permissions to the current user and administrators.");
	}
}

function keyObjects(privatePath, publicPath) {
	const privateKey = crypto.createPrivateKey(fs.readFileSync(privatePath));
	const publicKey = crypto.createPublicKey(fs.readFileSync(publicPath));
	if (privateKey.asymmetricKeyType !== "ed25519" ||
		publicKey.asymmetricKeyType !== "ed25519") {
		throw new Error("Issuer keypair must be Ed25519.");
	}
	const derived = crypto.createPublicKey(privateKey).export({ type: "spki", format: "der" });
	const stored = publicKey.export({ type: "spki", format: "der" });
	if (!crypto.timingSafeEqual(derived, stored)) {
		throw new Error("Issuer public and private keys do not match.");
	}
	return {
		privateKey,
		publicPem: publicKey.export({ type: "spki", format: "pem" }).toString(),
	};
}

function ensureIssuerKeys(directory, dependencies = {}) {
	const privatePath = path.join(directory, PRIVATE_KEY_NAME);
	const publicPath = path.join(directory, PUBLIC_KEY_NAME);
	const secureFile = dependencies.secureFile || ((file) => setWindowsAcl(file, false, dependencies.sid));
	const generate = dependencies.generate || (() => runCommand(
		process.execPath,
		[path.join(BACKEND_ROOT, "scripts", "licensing", "issuer.cjs"),
			"keygen", "--private-key", privatePath, "--public-key", publicPath],
		BACKEND_ROOT,
	));
	const privateExists = fs.existsSync(privatePath);
	const publicExists = fs.existsSync(publicPath);
	if (privateExists !== publicExists) {
		throw new Error("Issuer keypair is incomplete; restore the missing key from a secure backup.");
	}
	if (!privateExists && dependencies.expectedPublicPem) {
		throw new Error("Configured issuer public key exists but its private keypair is missing; restore it instead of regenerating.");
	}
	if (!privateExists) {
		generate();
		if (!fs.existsSync(privatePath) || !fs.existsSync(publicPath)) {
			throw new Error("Issuer key generation did not create a complete keypair.");
		}
	}
	secureFile(privatePath);
	try {
		const pair = keyObjects(privatePath, publicPath);
		if (dependencies.expectedPublicPem) {
			const configured = crypto.createPublicKey(dependencies.expectedPublicPem)
				.export({ type: "spki", format: "der" });
			const issuer = crypto.createPublicKey(pair.publicPem)
				.export({ type: "spki", format: "der" });
			if (!crypto.timingSafeEqual(configured, issuer)) throw new Error("Configured issuer key does not match.");
		}
		if (pair.publicPem.includes("PRIVATE KEY")) throw new Error("Public-key validation failed.");
		return { ...pair, privatePath, publicPath };
	} catch {
		throw new Error("Issuer keypair is corrupt or mismatched; it was not replaced.");
	}
}

function writeDesktopDatabaseConfig(filePath, serverEnv, frontendEnv) {
	const production = serverEnv.NODE_ENV === "production";
	const source = production ? {
		host: serverEnv.PRODUCTION_DB_HOSTNAME,
		port: serverEnv.PRODUCTION_DB_PORT,
		user: serverEnv.PRODUCTION_DB_USERNAME,
		password: serverEnv.PRODUCTION_DB_PASSWORD,
		database: serverEnv.PRODUCTION_DATABASE,
	} : {
		host: serverEnv.DB_HOST,
		port: serverEnv.DB_PORT,
		user: serverEnv.DB_USERNAME,
		password: serverEnv.DB_PASSWORD,
		database: serverEnv.DATABASE,
	};
	for (const [name, value] of Object.entries(source)) {
		if (typeof value !== "string" || !value) {
			throw new Error(`The current ${production ? "production" : "development"} .env database setting ${name} is required.`);
		}
	}
	if (typeof frontendEnv?.JWT_SECRET_KEY !== "string" || !frontendEnv.JWT_SECRET_KEY) {
		throw new Error("The frontend .env JWT_SECRET_KEY is required for desktop sessions.");
	}
	const control = {
		host: serverEnv.SYSTEM_CONFIG_DB_HOST || source.host,
		port: serverEnv.SYSTEM_CONFIG_DB_PORT || source.port,
		user: serverEnv.SYSTEM_CONFIG_DB_USERNAME || source.user,
		password: serverEnv.SYSTEM_CONFIG_DB_PASSWORD === undefined ? source.password : serverEnv.SYSTEM_CONFIG_DB_PASSWORD,
		database: serverEnv.SYSTEM_CONFIG_DATABASE || "primelabmaster_control",
	};
	let content = fs.readFileSync(filePath, "utf8");
	const eol = content.includes("\r\n") ? "\r\n" : "\n";
	const values = {
		NODE_ENV: "production",
		PRODUCTION_DB_HOSTNAME: source.host,
		PRODUCTION_DB_PORT: source.port,
		PRODUCTION_DB_USERNAME: source.user,
		PRODUCTION_DB_PASSWORD: source.password,
		PRODUCTION_DATABASE: source.database,
		DB_HOST: source.host,
		DB_PORT: source.port,
		DB_USERNAME: source.user,
		DB_PASSWORD: source.password,
		DATABASE: source.database,
		SYSTEM_CONFIG_DB_HOST: control.host,
		SYSTEM_CONFIG_DB_PORT: control.port,
		SYSTEM_CONFIG_DB_USERNAME: control.user,
		SYSTEM_CONFIG_DB_PASSWORD: control.password,
		SYSTEM_CONFIG_DATABASE: control.database,
		JWT_SECRET_KEY: frontendEnv.JWT_SECRET_KEY,
	};
	for (const [key, value] of Object.entries(values)) {
		content = setConfigValue(content, key, value, eol);
	}
	fs.writeFileSync(filePath, content);
}

function configuredPublicKey(config, configFile) {
	const inline = config.PLS_LICENSE_PUBLIC_KEY;
	const file = config.PLS_LICENSE_PUBLIC_KEY_FILE;
	if (inline && file) {
		throw new Error("Desktop config contains two issuer public-key sources; resolve the conflict before building.");
	}
	if (inline) {
		if (inline.includes("PRIVATE KEY")) throw new Error("Desktop config must not contain a private key.");
		const key = crypto.createPublicKey(inline);
		if (key.asymmetricKeyType !== "ed25519") throw new Error("Configured issuer key must be Ed25519.");
		return inline;
	}
	if (!file) return undefined;
	try {
		const resolved = path.isAbsolute(file) ? file : path.resolve(path.dirname(configFile), file);
		const pem = fs.readFileSync(resolved, "utf8");
		if (pem.includes("PRIVATE KEY")) throw new Error();
		if (crypto.createPublicKey(pem).asymmetricKeyType !== "ed25519") throw new Error();
		return pem;
	} catch {
		throw new Error("Configured issuer public-key file is missing or invalid; refusing to rotate issuer trust.");
	}
}

function setConfigValue(content, key, value, eol) {
	const expression = new RegExp(`^[\\t ]*${key}[\\t ]*=.*$`);
	const lines = content.split(/\r?\n/);
	const replacement = `${key}=${JSON.stringify(value)}`;
	let written = false;
	const output = [];
	for (const line of lines) {
		if (!expression.test(line)) {
			output.push(line);
		} else if (!written) {
			output.push(replacement);
			written = true;
		}
	}
	if (!written) {
		while (output.length && output[output.length - 1] === "") output.pop();
		output.push(replacement);
	}
	return output.join(eol);
}

function writeDesktopConfig(filePath, tenant, publicPem) {
	if (publicPem.includes("PRIVATE KEY")) throw new Error("Private key material cannot be packaged.");
	const key = crypto.createPublicKey(publicPem);
	if (key.asymmetricKeyType !== "ed25519") throw new Error("A public Ed25519 issuer key is required.");
	const original = fs.readFileSync(filePath, "utf8");
	const eol = original.includes("\r\n") ? "\r\n" : "\n";
	let next = original;
	next = next.split(/\r?\n/).filter(line => !/^[\t ]*PLS_LICENSE_PUBLIC_KEY_FILE[\t ]*=/.test(line)).join(eol);
	next = setConfigValue(next, "PLS_LICENSE_MODE", "signed", eol);
	next = setConfigValue(next, "PLS_DESKTOP_GENERIC", "false", eol);
	next = setConfigValue(next, "PLS_LICENSE_TENANT_ID", String(tenant), eol);
	next = setConfigValue(next, "PLS_LICENSE_PUBLIC_KEY", publicPem, eol);
	const parsed = parse(next);
	if (parsed.PLS_LICENSE_MODE !== "signed" ||
		parsed.PLS_LICENSE_TENANT_ID !== String(tenant) ||
		crypto.createPublicKey(parsed.PLS_LICENSE_PUBLIC_KEY).asymmetricKeyType !== "ed25519" ||
		parsed.PLS_LICENSE_PUBLIC_KEY.includes("PRIVATE KEY")) {
		throw new Error("Packaged desktop license configuration failed validation.");
	}
	const temporary = `${filePath}.${process.pid}.tmp`;
	try {
		fs.writeFileSync(temporary, next, { flag: "wx", mode: fs.statSync(filePath).mode });
		fs.renameSync(temporary, filePath);
	} catch (error) {
		try { fs.unlinkSync(temporary); } catch {}
		throw new Error("Could not safely update desktop/config/backend.env.");
	}
}

function runCommand(command, args, cwd, options = {}) {
	const batchCommand = process.platform === "win32" && /\.(cmd|bat)$/i.test(command);
	if (batchCommand && (path.basename(command).toLowerCase() !== "pnpm.cmd" ||
		args.some(argument => !/^[A-Za-z0-9:_-]+$/.test(argument)))) {
		throw new Error("Only fixed pnpm script arguments may use the Windows command interpreter.");
	}
	const executable = batchCommand ? (process.env.ComSpec || "cmd.exe") : command;
	const executableArgs = batchCommand
		? ["/d", "/s", "/c", `${command} ${args.join(" ")}`]
		: args;
	const result = (options.spawnSync || spawnSync)(executable, executableArgs, {
		cwd,
		env: options.env || process.env,
		stdio: options.stdio || "inherit",
		windowsHide: true,
		shell: options.shell === undefined ? false : options.shell,
	});
	if (result.error || result.status !== 0) {
		const code = result.status === null || result.status === undefined ? "could not start" : `exited with code ${result.status}`;
		throw new Error(`${options.label || "Build command"} ${code}.`);
	}
	return result;
}

async function tenantFromDatabase(serverEnv) {
	const production = serverEnv.NODE_ENV === "production";
	const databaseName = production ? serverEnv.PRODUCTION_DATABASE : serverEnv.DATABASE;
	const host = production ? serverEnv.PRODUCTION_DB_HOSTNAME : serverEnv.DB_HOST;
	const user = production ? serverEnv.PRODUCTION_DB_USERNAME : serverEnv.DB_USERNAME;
	const password = production ? serverEnv.PRODUCTION_DB_PASSWORD : serverEnv.DB_PASSWORD;
	const port = production ? serverEnv.PRODUCTION_DB_PORT : serverEnv.DB_PORT;
	const registryDatabase = serverEnv.SYSTEM_CONFIG_DATABASE || "primelabmaster_control";
	if (!databaseName || !host || !user || password === undefined) return null;

	let connection;
	try {
		const knex = require("knex");
		connection = knex({
			client: "mysql2",
			connection: {
				host: serverEnv.SYSTEM_CONFIG_DB_HOST || host,
				user: serverEnv.SYSTEM_CONFIG_DB_USERNAME || user,
				password: serverEnv.SYSTEM_CONFIG_DB_PASSWORD === undefined ? password : serverEnv.SYSTEM_CONFIG_DB_PASSWORD,
				database: registryDatabase,
				port: Number(serverEnv.SYSTEM_CONFIG_DB_PORT || port || 3306),
				connectTimeout: 5000,
			},
			pool: { min: 0, max: 1 },
		});
		const rows = await connection("prime_tenants")
			.select("tenant_number")
			.where({ database_name: databaseName })
			.limit(2)
			.timeout(7000);
		if (rows.length !== 1) return null;
		const resolved = positiveTenant(String(rows[0].tenant_number));
		return resolved;
	} catch {
		return null;
	} finally {
		if (connection) await connection.destroy().catch(() => {});
	}
}

async function resolveTenant(options, desktopConfig, serverEnv, environment = process.env) {
	const explicit = options["--tenant-id"] || environment.PLS_LICENSE_TENANT_ID ||
		desktopConfig.PLS_LICENSE_TENANT_ID || serverEnv.PLS_LICENSE_TENANT_ID;
	if (explicit) {
		const id = positiveTenant(String(explicit));
		if (!id) throw new Error("Configured tenant ID must be a positive safe integer.");
		return id;
	}
	const databaseTenant = await tenantFromDatabase(serverEnv);
	if (databaseTenant) return databaseTenant;
	const configuredDefault = environment.DEFAULT_TENANT_ID || serverEnv.DEFAULT_TENANT_ID;
	if (configuredDefault && !serverEnv.DATABASE && !serverEnv.PRODUCTION_DATABASE) {
		const id = positiveTenant(String(configuredDefault));
		if (id) return id;
	}
	throw new Error("No unambiguous tenant is configured. Supply --tenant-id or PLS_LICENSE_TENANT_ID; the build will not guess.");
}

function validateIsoArgument(value, option) {
	if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
		!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
		throw new Error(`${option} must be a UTC ISO timestamp such as 2026-01-01T00:00:00.000Z.`);
	}
}

function validateExternalStorage(directory) {
	if (!path.isAbsolute(directory)) throw new Error("Local activation storage must be an absolute path.");
	const resolved = path.resolve(directory);
	if (inside(BACKEND_ROOT, resolved) || inside(DESKTOP_ROOT, resolved)) {
		throw new Error("Local activation storage must be external to both project directories.");
	}
	return resolved;
}

function activateLocal(options, tenant, keyPair, keyDirectory) {
	validateIsoArgument(options["--starts-at"], "--starts-at");
	validateIsoArgument(options["--ends-at"], "--ends-at");
	if (Date.parse(options["--starts-at"]) > Date.parse(options["--ends-at"])) {
		throw new Error("--starts-at must not be later than --ends-at.");
	}
	const storageDirectory = validateExternalStorage(
		options["--local-storage-dir"] || process.env.PLS_LICENSE_STORAGE_DIR,
	);
	const temporaryDirectory = fs.mkdtempSync(path.join(keyDirectory, "local-activation-"));
	const requestPath = path.join(temporaryDirectory, "activation-request.json");
	const certificatePath = path.join(temporaryDirectory, "signed-certificate.json");
	const issuerPath = path.join(BACKEND_ROOT, "scripts", "licensing", "issuer.cjs");
	const cliEnvironment = {
		...process.env,
		PLS_LICENSE_MODE: "signed",
		PLS_LICENSE_TENANT_ID: String(tenant),
		PLS_LICENSE_PUBLIC_KEY: keyPair.publicPem,
		PLS_LICENSE_STORAGE_DIR: storageDirectory,
	};
	try {
		runCommand(process.execPath, [LICENSE_CLI, "request", "--tenant-id", String(tenant), "--output", requestPath],
			BACKEND_ROOT, { env: cliEnvironment, label: "Build-machine request" });
		const signArguments = [
			issuerPath, "sign-request",
			"--private-key", keyPair.privatePath,
			"--request", requestPath,
			"--output", certificatePath,
			"--starts-at", options["--starts-at"],
			"--ends-at", options["--ends-at"],
			"--grace-days", options["--grace-days"] || "0",
		];
		if (options["--license-id"]) signArguments.push("--license-id", options["--license-id"]);
		runCommand(process.execPath, signArguments, BACKEND_ROOT, { label: "Build-machine certificate signing" });
		runCommand(process.execPath, [LICENSE_CLI, "activate", "--tenant-id", String(tenant), "--file", certificatePath],
			BACKEND_ROOT, { env: cliEnvironment, label: "Build-machine activation" });
	} finally {
		fs.rmSync(temporaryDirectory, { recursive: true, force: true });
	}
}

function installerSnapshot(directory) {
	try {
		return new Map(fs.readdirSync(directory)
			.filter(file => file.toLowerCase().endsWith(".exe"))
			.map(file => {
				const target = path.join(directory, file);
				const stat = fs.statSync(target);
				return [target, `${stat.size}:${stat.mtimeMs}`];
			}));
	} catch (error) {
		if (error.code === "ENOENT") return new Map();
		throw error;
	}
}

function assertRuntimeHasNoPrivateKey(runtimeRoot) {
	const pending = [runtimeRoot];
	while (pending.length) {
		const current = pending.pop();
		if (!fs.existsSync(current)) continue;
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const target = path.join(current, entry.name);
			if (entry.isDirectory()) pending.push(target);
			else if (entry.isFile() && /\.(pem|key|env)$/i.test(entry.name)) {
				const stat = fs.statSync(target);
				if (stat.size <= 1024 * 1024 &&
					/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/.test(fs.readFileSync(target, "utf8"))) {
					throw new Error("Issuer private-key material must never be copied into the desktop runtime.");
				}
			}
		}
	}
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
	const options = parseArguments(argv);
	let configFile = dependencies.configFile || DESKTOP_CONFIG;
	const config = readEnv(configFile);
	const expectedPublicPem = configuredPublicKey(config, configFile);
	const environment = dependencies.environment || process.env;
	if (environment.PLS_DESKTOP_GENERIC !== undefined && !["true", "false"].includes(environment.PLS_DESKTOP_GENERIC)) {
		throw new Error("PLS_DESKTOP_GENERIC must be true or false.");
	}
	if (environment.PLS_DESKTOP_GENERIC === "true") {
		throw new Error("Generic standalone auto-provisioning has been retired. Provision the local database first and build a facility-specific desktop.");
	}
	const generic = false;
	if (!fs.existsSync(configFile)) throw new Error("Facility-specific backend configuration is missing.");
	const serverEnv = dependencies.serverEnv || readEnv(path.join(BACKEND_ROOT, ".env"));
	const tenant = await resolveTenant(options, config, serverEnv, environment);
	const directory = externalKeyDirectory(dependencies.keyDirectory || issuerDirectory());
	const sid = dependencies.sid || getWindowsSid();
	fs.mkdirSync(directory, { recursive: true });
	(dependencies.secureDirectory || ((target) => setWindowsAcl(target, true, sid)))(directory);
	const keyPair = ensureIssuerKeys(directory, {
		sid,
		secureFile: dependencies.secureFile || ((target) => setWindowsAcl(target, false, sid)),
		generate: dependencies.generateKeys,
		expectedPublicPem,
	});
	if (generic) {
		const { genericConfig } = require(path.join(DESKTOP_ROOT, "desktop", "generic-config.cjs"));
		const verifier = await require("./installation-verifier.cjs").installationVerifier(directory, {
			prompt: dependencies.installationPrompt,
			secure: dependencies.secureFile || ((target) => setWindowsAcl(target, false, sid)),
		});
		const installerVerifierFile = path.join(directory, "installer-verifier.json");
		if (!fs.existsSync(installerVerifierFile)) {
			throw new Error("Configure the installer password once using desktop:configure-install-password.");
		}
		configFile = path.join(directory, "generic-backend.env");
		fs.writeFileSync(configFile, genericConfig(keyPair.publicPem, parse, verifier), { mode: 0o600 });
	} else {
		writeDesktopDatabaseConfig(configFile, serverEnv,
			readEnv(path.join(DESKTOP_ROOT, ".env")));
		writeDesktopConfig(configFile, tenant, keyPair.publicPem);
	}
	if (options["--prepare-only"]) {
		console.log("Signed desktop configuration is ready. Compilation and installer packaging were skipped.");
		return;
	}

	const backendOverride = process.env.PLS_DESKTOP_BACKEND_ENV;
	if (!generic && backendOverride && path.resolve(backendOverride) !== path.resolve(configFile)) {
		throw new Error("Unset PLS_DESKTOP_BACKEND_ENV or point it to desktop/config/backend.env before building.");
	}
	runCommand(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", "build"], BACKEND_ROOT, {
		label: "Backend TypeScript compilation",
	});
	if (options["--activate-local"]) activateLocal(options, tenant, keyPair, directory);

	const outputDirectory = path.join(DESKTOP_ROOT, "dist-electron");
	const before = installerSnapshot(outputDirectory);
	const desktopEnvironment = {
		...process.env,
		PLS_DESKTOP_GENERIC: String(generic),
		PLS_DESKTOP_BACKEND_ENV: configFile,
		PLS_SERVER_DIR: BACKEND_ROOT,
		PLS_INSTALLER_VERIFIER_FILE: path.join(directory, "installer-verifier.json"),
	};
	if (generic) {
		const desktopFile = path.join(directory, "generic-desktop.env");
		fs.writeFileSync(desktopFile, "PLS_DESKTOP_MODE=standalone\n", { mode: 0o600 });
		desktopEnvironment.PLS_DESKTOP_CONFIG = desktopFile;
	}
	runCommand(process.platform === "win32" ? "pnpm.cmd" : "pnpm",
		["run", "desktop:dist:win"], DESKTOP_ROOT, {
			env: desktopEnvironment,
			label: "Windows desktop installer build",
		});
	assertRuntimeHasNoPrivateKey(path.join(DESKTOP_ROOT, ".desktop-runtime"));
	const changed = [...installerSnapshot(outputDirectory)]
		.filter(([file, hash]) => before.get(file) !== hash)
		.map(([file]) => file);
	if (!changed.length) throw new Error("Desktop build succeeded but did not produce a new Windows installer.");
	console.log(`Signed-license-enforced installer created: ${changed.map(file => path.relative(DESKTOP_ROOT, file)).join(", ")}`);
}

if (require.main === module) {
	main().catch(error => {
		const message = error && typeof error.message === "string" ? error.message : "Unknown error.";
		console.error(`Licensed desktop build failed: ${message}`);
		process.exitCode = 1;
	});
}

module.exports = {
	activateLocal,
	assertRuntimeHasNoPrivateKey,
	ensureIssuerKeys,
	configuredPublicKey,
	externalKeyDirectory,
	getWindowsSid,
	inside,
	main,
	parseArguments,
	resolveTenant,
	runCommand,
	setConfigValue,
	setWindowsAcl,
	tenantFromDatabase,
	validateExternalStorage,
	writeDesktopConfig,
	writeDesktopDatabaseConfig,
};
