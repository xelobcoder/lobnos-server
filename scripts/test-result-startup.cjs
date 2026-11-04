const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function startup({ blocked = false } = {}) {
    const events = [];
    const connection = { tenant: 42 };
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", "src", "bootstrap", "applicationStartup.ts"), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(source, {
        exports: module.exports, module, console,
        require(name) {
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
