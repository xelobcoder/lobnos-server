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

test("automated build defaults to generic without DB lookup, preserves source secrets and reuses keys", async t => {
		const directory = temporaryDirectory(t, "pls-generic-automation-");
		const source = path.join(directory, "source.env");
		fs.writeFileSync(source, "PRODUCTION_DB_PASSWORD=never-package-this\nPLS_LICENSE_TENANT_ID=638241\n");
		const pair = makePair();
		let generated = 0;
		const dependencies = {
			configFile: source, keyDirectory: directory, environment: {}, sid: "test-sid",
			installationPrompt: async () => "fixture-install-password-only",
			secureFile() {}, secureDirectory() {},
			get serverEnv() { throw new Error("Generic builds must not load the server environment or database"); },
			generateKeys() {
				generated++;
				fs.writeFileSync(path.join(directory, "issuer-private.pem"), pair.privatePem);
				fs.writeFileSync(path.join(directory, "issuer-public.pem"), pair.publicPem);
			},
		};
		await main(["--prepare-only"], dependencies);
		const first = fs.readFileSync(path.join(directory, "generic-backend.env"), "utf8");
		await main(["--prepare-only"], dependencies);
		assert.equal(generated, 1);
		assert.equal(fs.readFileSync(path.join(directory, "generic-backend.env"), "utf8"), first);
		assert.match(first, /PLS_DESKTOP_GENERIC=true/);
		assert.doesNotMatch(first, /never-package-this|TENANT_ID|PRIVATE KEY|DB_PASSWORD/);
		assert.match(fs.readFileSync(source, "utf8"), /never-package-this/);
		await assert.rejects(main(["--tenant-id", "638241", "--prepare-only"], dependencies), /Generic builds do not bind/);
		dependencies.environment = { PLS_DESKTOP_GENERIC: "TRUE" };
		await assert.rejects(main(["--prepare-only"], dependencies), /must be true or false/);
});
