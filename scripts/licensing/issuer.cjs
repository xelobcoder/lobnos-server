#!/usr/bin/env node
// ISSUER WORKSTATION ONLY. Never include this directory in a customer runtime.
// Requires the verifier from a backend build; all cryptography uses Node builtins.
const fs = require('fs');
const crypto = require('crypto');
const { canonicalPayload, parseCertificate, publicKey } = require('../../dist/src/licensing/certificate.js');

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
  };
  if (!allowed[command] || Object.keys(opts).some(k => !allowed[command].includes(k)) ||
      allowed[command].some(k => !opts[k])) throw new Error('Invalid arguments');
  if (command === 'keygen') {
    const pair = crypto.generateKeyPairSync('ed25519');
    // Exclusive writes never overwrite existing issuer keys. Restrict ACLs separately on Windows.
    fs.writeFileSync(opts['--private-key'], pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(opts['--public-key'], pair.publicKey.export({ type: 'spki', format: 'pem' }), { flag: 'wx', mode: 0o644 });
  } else {
    if (fs.statSync(opts['--payload']).size > 65536) throw new Error('Invalid payload');
    const payload = JSON.parse(fs.readFileSync(opts['--payload'], 'utf8'));
    const key = crypto.createPrivateKey(fs.readFileSync(opts['--private-key'], 'utf8'));
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('Ed25519 key required');
    const signature = crypto.sign(null, canonicalPayload(payload), key).toString('base64');
    const certificate = parseCertificate({ payload, signature });
    publicKey(crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString());
    fs.writeFileSync(opts['--output'], JSON.stringify(certificate, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  console.log(JSON.stringify({ status: 'success' }));
}
if (require.main === module) {
  try { run(process.argv.slice(2)); }
  catch {
    // Never print input, private key, filesystem paths, or crypto parser diagnostics.
    console.error(JSON.stringify({ status: 'error', message: 'Issuer operation failed; check arguments, files and Ed25519 key.' }));
    process.exitCode = 1;
  }
}
