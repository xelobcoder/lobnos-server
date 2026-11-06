const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function startup({ blocked = false, finalCollationBlocked = false } = {}) {
    const events = [];
    let collationPasses = 0;
    const connection = { tenant: 42 };
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", "src", "bootstrap", "applicationStartup.ts"), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, {
        exports: module.exports, module, console,
        require(name) {
            if (name.endsWith("/TenantCollation")) return {
                ensureTenantCollationDefault: async () => { events.push(["collation-default"]); },
                normalizeTenantCollation: async db => {
                    assert.equal(db, connection);
                    events.push(["collation-check"]);
                    if (++collationPasses === 2 && finalCollationBlocked) throw new Error("Final collation compliance failed");
                },
            };
            if (name.endsWith("KnexConnections")) return { __esModule: true, default: async tenant => { events.push(["connection", tenant]); return connection; } };
            if (name.endsWith("20261103_result_save_identity")) return {
                up: async db => {
                    assert.equal(db, connection);
                    events.push(["result-schema"]);
                    if (blocked) throw new Error("Result identities need reviewed repair");
                },
            };
            if (name.endsWith("20261107_pharmacy_return_value")) return {
                up: async db => { assert.equal(db, connection); events.push(["return-schema"]); },
            };
            return new Proxy({ __esModule: true }, {
                get(target, key) {
                    if (key in target) return target[key];
                    return async () => { events.push([String(key)]); };
                },
            });
        },
    });
    return { run: module.exports.runApplicationBootstrappers, events };
}

test("served-tenant startup installs result retry and Pharmacy return schemas before readiness", async () => {
    const h = startup();
    const ready = await h.run(42, true);
    assert.equal(ready.accountingReady, true);
    const at = name => h.events.findIndex(event => event[0] === name);
    assert.ok(at("bootstrapCalculationAndQcTables") < at("result-schema"));
    assert.ok(at("result-schema") < at("bootstrapAccountingTables"));
    assert.ok(at("bootstrapPharmacyTables") < at("return-schema"));
    assert.ok(h.events.filter(event => event[0] === "connection").every(event => event[1] === 42));
});
test("ambiguous result identities prevent tenant readiness instead of silently skipping safety setup", async () => {
    const h = startup({ blocked: true });
    await assert.rejects(h.run(42), /reviewed repair/);
    assert.ok(!h.events.some(event => event[0] === "bootstrapAccountingTables"));
});
test("strict bootstrap checks new tables after all schema work and before starting workers", async () => {
    const h = startup();
    await h.run(42, true);
    const checks = h.events.flatMap((event, index) => event[0] === "collation-check" ? [index] : []);
    assert.equal(checks.length, 2);
    assert.ok(checks[0] < h.events.findIndex(event => event[0] === "bootstrapLoginAccountSchema"));
    assert.ok(checks[1] > h.events.findIndex(event => event[0] === "bootstrapAccountingTables"));
    assert.ok(checks[1] < h.events.findIndex(event => event[0] === "startCrmReminderWorker"));
});
test("strict migration cannot report readiness or start workers with final collation drift", async () => {
    const h = startup({ finalCollationBlocked: true });
    await assert.rejects(h.run(42, true), /Final collation compliance failed/);
    assert.ok(!h.events.some(event => event[0] === "startCrmReminderWorker"));
});
test("normal startup never performs implicit table conversions", async () => {
    const h = startup();
    await h.run(42);
    assert.ok(h.events.some(event => event[0] === "collation-default"));
    assert.ok(!h.events.some(event => event[0] === "collation-check"));
});
