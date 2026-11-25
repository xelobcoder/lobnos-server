const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function validate(extra, configured = 'primelabmaster') {
    let connections = 0;
    const errors = [];
    const process = { argv: ['node', 'backup', '--database', 'primelabmaster', '--output', 'unused', '--verify-restore', 'primelabmaster_restore_test', ...extra], exit: () => undefined };
    const module = { exports: {} };
    function load(name) {
        if (name === 'mysql2/promise') return { createConnection: async () => { connections++; throw new Error('VALIDATION_PASSED'); } };
        if (name === '../dist/src/database/connection') return { singleTenantKnexInstance: { client: { config: { connection: { database: configured } } } } };
        if (name.startsWith('../dist/')) return {};
        return require(name);
    }
    load.main = module;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'legacy-upgrade-backup.cjs'), 'utf8'), {
        process, module, require: load, console: { error: message => errors.push(message) },
    });
    await new Promise(resolve => setImmediate(resolve));
    return { connections, errors };
}

test('database-scoped maintenance backup requires an explicit scope and exact configured database', async () => {
    assert.equal((await validate(['--database-scope'])).connections, 1);
    const mismatch = await validate(['--database-scope'], 'another_database');
    assert.equal(mismatch.connections, 0);
    assert.match(mismatch.errors[0], /must match this installation/);
});
test('tenant maintenance backups retain registered identity validation', async () => {
    assert.equal((await validate(['--tenant', '876954'])).connections, 1);
    for (const extra of [[], ['--tenant', '0'], ['--tenant', 'invalid'], ['--database-scope', '--tenant', '876954']]) {
        assert.equal((await validate(extra)).connections, 0);
    }
});
