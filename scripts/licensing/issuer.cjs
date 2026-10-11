#!/usr/bin/env node
// ISSUER WORKSTATION ONLY. Never include this directory in a customer runtime.
// Requires the verifier from a backend build; all cryptography uses Node builtins.
const fs = require('fs');
const crypto = require('crypto');
function certificateTools() {
	return require('../../dist/src/licensing/certificate.js');
}

function run(args) {
	const [command, ...rest] = args;
	const opts = {};
	for (let i = 0; i < rest.length; i += 2) {
		if (!rest[i].startsWith('--') || !rest[i + 1] || opts[rest[i]] !== undefined) throw new Error('Invalid arguments');
		opts[rest[i]] = rest[i + 1];
	}
	const allowed = {
		keygen: ['--private-key', '--public-key'],
		sign: ['--private-key', '--payload', '--output'],
		'sign-request': ['--private-key', '--request', '--output', '--starts-at', '--ends-at', '--grace-days', '--license-id'],
	};
	const required = {
		keygen: ['--private-key', '--public-key'],
		sign: ['--private-key', '--payload', '--output'],
		'sign-request': ['--private-key', '--request', '--output', '--starts-at', '--ends-at'],
	};
	if (!allowed[command] || Object.keys(opts).some(k => !allowed[command].includes(k)) ||
		required[command].some(k => !opts[k])) {
		throw new Error('Invalid arguments');
	}
	if (command === 'keygen') {
		const pair = crypto.generateKeyPairSync('ed25519');
		// Exclusive writes never overwrite existing issuer keys. Restrict ACLs separately on Windows.
		fs.writeFileSync(opts['--private-key'], pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
		fs.writeFileSync(opts['--public-key'], pair.publicKey.export({ type: 'spki', format: 'pem' }), { flag: 'wx', mode: 0o644 });
	} else {
		const tools = certificateTools();
		const payload = command === 'sign-request'
			? payloadFromRequest(opts)
			: readPayload(opts['--payload']);
		const key = crypto.createPrivateKey(fs.readFileSync(opts['--private-key'], 'utf8'));
		if (key.asymmetricKeyType !== 'ed25519') throw new Error('Ed25519 key required');
		const signature = crypto.sign(null, tools.canonicalPayload(payload), key).toString('base64');
		const certificate = tools.parseCertificate({ payload, signature });
		tools.publicKey(crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString());
		fs.writeFileSync(opts['--output'], JSON.stringify(certificate, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
	}
	console.log(JSON.stringify({ status: 'success' }));
}

function readPayload(filePath) {
	if (fs.statSync(filePath).size > 65536) throw new Error('Invalid payload');
	return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function payloadFromRequest(opts) {
	const { publicKey, keyFingerprint, tenantId } = certificateTools();
	if (fs.statSync(opts['--request']).size > 65536) throw new Error('Invalid request');
	const request = JSON.parse(fs.readFileSync(opts['--request'], 'utf8'));
	const requestKeys = ['deviceFingerprint', 'installationId', 'installationPublicKey',
		'installationPublicKeyFingerprint', 'tenantId', 'version'].sort().join(',');
	if (!request || typeof request !== 'object' || Array.isArray(request) ||
		Object.keys(request).sort().join(',') !== requestKeys || request.version !== 1) {
		throw new Error('Invalid request');
	}
	const id = tenantId(request.tenantId);
	if (!/^[a-f0-9]{32}$/.test(request.installationId) ||
		!/^[a-f0-9]{64}$/.test(request.deviceFingerprint) ||
		!/^[a-f0-9]{64}$/.test(request.installationPublicKeyFingerprint)) {
		throw new Error('Invalid request');
	}
	const installationKey = publicKey(request.installationPublicKey);
	if (keyFingerprint(request.installationPublicKey) !== request.installationPublicKeyFingerprint) {
		throw new Error('Invalid request');
	}
	const startsAt = isoTimestamp(opts['--starts-at']);
	const endsAt = isoTimestamp(opts['--ends-at']);
	const graceDays = opts['--grace-days'] === undefined ? 0 : Number(opts['--grace-days']);
	const licenseId = opts['--license-id'] || crypto.randomUUID();
	if (Date.parse(startsAt) > Date.parse(endsAt) ||
		!Number.isSafeInteger(graceDays) || graceDays < 0 || graceDays > 365 ||
		!/^[A-Za-z0-9_-]{1,128}$/.test(licenseId) ||
		installationKey.asymmetricKeyType !== 'ed25519') {
		throw new Error('Invalid license terms');
	}
	return {
		version: 1,
		licenseId,
		tenantId: id,
		installationId: request.installationId,
		installationPublicKeyFingerprint: request.installationPublicKeyFingerprint,
		deviceFingerprint: request.deviceFingerprint,
		startsAt,
		endsAt,
		graceDays,
	};
}

function isoTimestamp(value) {
	const time = typeof value === 'string' ? Date.parse(value) : NaN;
	if (!Number.isFinite(time)) throw new Error('Invalid date');
	const result = new Date(time).toISOString();
	if (value !== result) throw new Error('Timestamps must be UTC ISO dates with milliseconds');
	return result;
}

if (require.main === module) {
	try { run(process.argv.slice(2)); }
	catch {
		// Never print input, private key, filesystem paths, or crypto parser diagnostics.
		console.error(JSON.stringify({ status: 'error', message: 'Issuer operation failed; check arguments, files and Ed25519 key.' }));
		process.exitCode = 1;
	}
}

module.exports = { payloadFromRequest, run };
