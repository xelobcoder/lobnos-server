"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
	assertRuntimeHasNoPrivateKey,
	ensureIssuerKeys,
	getWindowsSid,
	parseArguments,
	resolveTenant,
	runCommand,
	setWindowsAcl,
	writeDesktopConfig,
	main,
} = require("./build-desktop.cjs");

function temporaryDirectory(t, prefix) {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
	t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
	return directory;
}

function makePair() {
	const pair = crypto.generateKeyPairSync("ed25519");
	return {
		privatePem: pair.privateKey.export({ type: "pkcs8", format: "pem" }),
		publicPem: pair.publicKey.export({ type: "spki", format: "pem" }),
	};
}

test("Windows identity lookup bypasses PATH and parses the native CSV SID", () => {
	let invocation;
	const sid = getWindowsSid({
		environment: { SystemRoot: "C:\\Windows", PATH: "C:\\Program Files\\Git\\usr\\bin" },
		execFileSync(command, args, options) {
			invocation = { command, args, options };
			return '"workstation\\fixture","S-1-5-21-111-222-333-1001"\r\n';
		},
	});
	assert.equal(sid, "S-1-5-21-111-222-333-1001");
	assert.equal(invocation.command, "C:\\Windows\\System32\\whoami.exe");
	assert.deepEqual(invocation.args, ["/user", "/fo", "csv", "/nh"]);
	assert.equal(invocation.options.shell, false);
});

test("Windows identity lookup fails explicitly without a SID or native executable", () => {
	for (const exec of [
		() => "fixture\n",
		() => { throw new Error("fixture process failure"); },
	]) {
		assert.throws(() => getWindowsSid({
			environment: { SystemRoot: "C:\\Windows" }, execFileSync: exec,
		}), /Could not determine the current Windows security identifier/);
	}
	for (const environment of [{}, { SystemRoot: "relative" }]) {
		assert.throws(() => getWindowsSid({
			environment, execFileSync: () => assert.fail("must not search PATH"),
		}), /Could not determine the current Windows security identifier/);
	}
});

test("Windows ACL setup bypasses PATH and preserves file and directory grants", {
	skip: process.platform !== "win32",
}, () => {
	const sid = "S-1-5-21-111-222-333-1001";
	for (const directory of [false, true]) {
		let invocation;
		setWindowsAcl("C:\\fixture\\verifier.json", directory, sid, {
			environment: { WINDIR: "D:\\Windows", PATH: "C:\\Program Files\\Git\\usr\\bin" },
			spawnSync(command, args, options) {
				invocation = { command, args, options };
				return { status: 0 };
			},
		});
		assert.equal(invocation.command, "D:\\Windows\\System32\\icacls.exe");
		assert.deepEqual(invocation.args, [
			"C:\\fixture\\verifier.json", "/inheritance:r", "/grant:r",
			`*${sid}:${directory ? "(OI)(CI)F" : "F"}`,
			`*S-1-5-32-544:${directory ? "(OI)(CI)F" : "F"}`,
		]);
		assert.equal(invocation.options.shell, false);
	}
	for (const result of [{ status: 1 }, { status: null, error: new Error("fixture") }]) {
		assert.throws(() => setWindowsAcl("C:\\fixture\\verifier.json", false, sid, {
			environment: { SystemRoot: "C:\\Windows" }, spawnSync: () => result,
		}), /Could not restrict issuer key permissions/);
	}
});

test("native Windows utilities secure both verifier files end to end", {
	skip: process.platform !== "win32",
}, async t => {
	const directory = temporaryDirectory(t, "pls-native-verifier-");
	const sid = getWindowsSid();
	const secured = [];
	await require("./installation-verifier.cjs").installationVerifier(directory, {
		configure: true,
		prompt: async () => "fixture-native-installation-only",
		secure(file) {
			setWindowsAcl(file, false, sid);
			secured.push(path.basename(file));
		},
	});
	assert.equal(secured.length, 3);
	assert.ok(secured.includes("installation-verifier.json"));
	assert.ok(secured.includes("installer-verifier.json"));
	for (const filename of ["installation-verifier.json", "installer-verifier.json"]) {
		assert.ok(fs.existsSync(path.join(directory, filename)));
	}
});

test("issuer keypair is reused and never regenerated once present", (t) => {
	const directory = temporaryDirectory(t, "pls-issuer-reuse-");
	const pair = makePair();
	let generations = 0;
	const dependencies = {
		secureFile() {},
		generate() {
			generations++;
			fs.writeFileSync(path.join(directory, "issuer-private.pem"), pair.privatePem, { flag: "wx" });
			fs.writeFileSync(path.join(directory, "issuer-public.pem"), pair.publicPem, { flag: "wx" });
		},
	};
	const first = ensureIssuerKeys(directory, dependencies);
	const second = ensureIssuerKeys(directory, dependencies);
	assert.equal(generations, 1);
	assert.equal(first.publicPem, second.publicPem);
	assert.match(first.publicPem, /BEGIN PUBLIC KEY/);
	assert.doesNotMatch(first.publicPem, /PRIVATE KEY/);
});

test("incomplete and mismatched issuer keypairs fail without replacement", (t) => {
	const directory = temporaryDirectory(t, "pls-issuer-invalid-");
	const first = makePair();
	const other = makePair();
	const privatePath = path.join(directory, "issuer-private.pem");
	const publicPath = path.join(directory, "issuer-public.pem");
	let generations = 0;
	fs.writeFileSync(privatePath, first.privatePem);
	assert.throws(
		() => ensureIssuerKeys(directory, { secureFile() {}, generate() { generations++; } }),
		/incomplete/,
	);
	assert.equal(generations, 0);
	fs.writeFileSync(publicPath, other.publicPem);
	assert.throws(
		() => ensureIssuerKeys(directory, { secureFile() {}, generate() { generations++; } }),
		/mismatched/,
	);
	assert.equal(generations, 0);
});

test("an existing configured public key prevents silent key loss or issuer rotation", (t) => {
	const directory = temporaryDirectory(t, "pls-issuer-trust-");
	const active = makePair();
	const replacement = makePair();
	let generations = 0;
	assert.throws(
		() => ensureIssuerKeys(directory, {
			expectedPublicPem: active.publicPem,
			secureFile() {},
			generate() { generations++; },
		}),
		/private keypair is missing/,
	);
	assert.equal(generations, 0);

	fs.writeFileSync(path.join(directory, "issuer-private.pem"), replacement.privatePem);
	fs.writeFileSync(path.join(directory, "issuer-public.pem"), replacement.publicPem);
	assert.throws(
		() => ensureIssuerKeys(directory, {
			expectedPublicPem: active.publicPem,
			secureFile() {},
			generate() { generations++; },
		}),
		/mismatched/,
	);
	assert.equal(generations, 0);
});

test("signed desktop config preserves unrelated env and contains only the public key", (t) => {
	const directory = temporaryDirectory(t, "pls-desktop-env-");
	const configPath = path.join(directory, "backend.env");
	const sourceEnvPath = path.join(directory, ".env");
	const pair = makePair();
	const original = [
		"NODE_ENV=production",
		"APPHOST=localhost",
		"PLS_LICENSE_PUBLIC_KEY_FILE=old-public.pem",
		"PLS_LICENSE_MODE=legacy",
		"PLS_LICENSE_TENANT_ID=3",
		"",
	].join("\r\n");
	fs.writeFileSync(configPath, original);
	fs.writeFileSync(sourceEnvPath, "DATABASE=untouched_backend_database\n");
	const sourceBefore = fs.readFileSync(sourceEnvPath, "utf8");

	writeDesktopConfig(configPath, 638241, pair.publicPem);

	const updated = fs.readFileSync(configPath, "utf8");
	assert.match(updated, /NODE_ENV=production/);
	assert.match(updated, /APPHOST=localhost/);
	assert.match(updated, /PLS_LICENSE_MODE="signed"/);
	assert.match(updated, /PLS_LICENSE_TENANT_ID="638241"/);
	assert.match(updated, /PLS_LICENSE_PUBLIC_KEY=/);
	assert.doesNotMatch(updated, /PLS_LICENSE_PUBLIC_KEY_FILE=/);
	assert.doesNotMatch(updated, /PRIVATE KEY/);
	assert.equal(fs.readFileSync(sourceEnvPath, "utf8"), sourceBefore);
});

test("runtime private key scan rejects any private PEM content", (t) => {
	const runtime = temporaryDirectory(t, "pls-runtime-private-");
	const pair = makePair();
	fs.writeFileSync(path.join(runtime, "data.pem"), pair.privatePem);
	assert.throws(() => assertRuntimeHasNoPrivateKey(runtime), /private-key material/);
});

test("tenant resolution does not invent the legacy fallback tenant", async () => {
	await assert.rejects(
		() => resolveTenant({}, {}, {}, {}),
		/No unambiguous tenant/,
	);
	assert.equal(await resolveTenant({}, { PLS_LICENSE_TENANT_ID: "638241" }, {}, {}), 638241);
});

test("prepare-only accepts no package command and activation requires explicit terms", () => {
	assert.equal(parseArguments(["--prepare-only"])["--prepare-only"], true);
	assert.equal(parseArguments(["--", "--prepare-only"])["--prepare-only"], true);
	assert.throws(
		() => parseArguments(["--activate-local", "--local-storage-dir", path.resolve("license-state")]),
		/requires --starts-at and --ends-at/,
	);
});

test("non-zero build subprocess exit is propagated as an error", () => {
	assert.throws(
		() => runCommand("pnpm.cmd", ["run", "build"], process.cwd(), {
			label: "TypeScript compilation",
			spawnSync: () => ({ status: 9, error: null }),
		}),
		/TypeScript compilation exited with code 9/,
	);
});

test("Windows package scripts use cmd.exe without a shell and only fixed arguments", () => {
	let invocation;
	runCommand("pnpm.cmd", ["run", "build"], process.cwd(), {
		spawnSync(command, args, options) {
			invocation = { command, args, options };
			return { status: 0, error: null };
		},
	});

	if (process.platform === "win32") {
		assert.equal(path.basename(invocation.command).toLowerCase(), "cmd.exe");
		assert.deepEqual(invocation.args, ["/d", "/s", "/c", "pnpm.cmd run build"]);
		assert.equal(invocation.options.shell, false);
		assert.throws(
			() => runCommand("pnpm.cmd", ["run", "build; whoami"], process.cwd()),
			/Only fixed pnpm script arguments/,
		);
	} else {
		assert.equal(invocation.command, "pnpm.cmd");
		assert.deepEqual(invocation.args, ["run", "build"]);
	}
});

test("retired generic auto-provisioning build configuration is rejected", async t => {
	const directory = temporaryDirectory(t, "pls-generic-retired-");
	const config = path.join(directory, "backend.env");
	fs.writeFileSync(config, "PLS_LICENSE_TENANT_ID=638241\n");
	await assert.rejects(main(["--prepare-only"], {
		configFile: config,
		keyDirectory: directory,
		environment: { PLS_DESKTOP_GENERIC: "true" },
	}), /auto-provisioning has been retired/);
});

test("facility desktop config uses the provisioned database settings from backend .env", (t) => {
	const directory = temporaryDirectory(t, "pls-desktop-db-config-");
	const config = path.join(directory, "backend.env");
	fs.writeFileSync(config, "NODE_ENV=development\n");
	const sourceEnv = [
		"NODE_ENV=development",
		"DB_HOST=127.0.0.1",
		"DB_PORT=2309",
		"DB_USERNAME=root",
		"DB_PASSWORD=fixture-db-password",
		"DATABASE=primelabtestmig",
		"SYSTEM_CONFIG_DB_HOST=localhost",
		"SYSTEM_CONFIG_DB_PORT=2309",
		"SYSTEM_CONFIG_DB_USERNAME=root",
		"SYSTEM_CONFIG_DB_PASSWORD=fixture-control-password",
		"SYSTEM_CONFIG_DATABASE=primelabmaster_control",
	].join("\n");
	const sourceFile = path.join(directory, ".env");
	fs.writeFileSync(sourceFile, sourceEnv);
	const { parse } = require("dotenv");
	const { writeDesktopDatabaseConfig } = require("./build-desktop.cjs");
	writeDesktopDatabaseConfig(config, parse(sourceEnv), { JWT_SECRET_KEY: "fixture-frontend-secret" });
	const packaged = parse(fs.readFileSync(config, "utf8"));
	assert.equal(packaged.PRODUCTION_DB_HOSTNAME, "127.0.0.1");
	assert.equal(packaged.PRODUCTION_DB_PORT, "2309");
	assert.equal(packaged.PRODUCTION_DB_USERNAME, "root");
	assert.equal(packaged.PRODUCTION_DATABASE, "primelabtestmig");
	assert.equal(packaged.PRODUCTION_DB_PASSWORD, "fixture-db-password");
	assert.equal(packaged.SYSTEM_CONFIG_DB_USERNAME, "root");
	assert.equal(packaged.SYSTEM_CONFIG_DB_PASSWORD, "fixture-control-password");
	assert.equal(packaged.SYSTEM_CONFIG_DATABASE, "primelabmaster_control");
	assert.equal(packaged.JWT_SECRET_KEY, "fixture-frontend-secret");
	assert.equal(fs.readFileSync(sourceFile, "utf8"), sourceEnv);
});
