"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNextTestPanelId = void 0;
async function generateNextTestPanelId(db) {
    var _a;
    const raw = await db.raw("SELECT MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) AS max_id FROM test_panels WHERE id REGEXP '^100[0-9]+$' FOR UPDATE");
    const rows = Array.isArray(raw) ? raw[0] : (_a = raw === null || raw === void 0 ? void 0 : raw[0]) !== null && _a !== void 0 ? _a : raw;
    const firstRow = Array.isArray(rows) ? rows[0] : rows;
    const maxId = firstRow && typeof firstRow.max_id !== "undefined" ? Number(firstRow.max_id) : NaN;
    let next = Number.isFinite(maxId) ? maxId + 1 : 101;
    for (let i = 0; i < 50; i++) {
        const candidate = `100${next}`;
        const exists = await db("test_panels").select("id").where({ id: candidate }).first();
        if (!exists)
            return candidate;
        next++;
    }
    throw new Error("unable to generate test panel id");
}
exports.generateNextTestPanelId = generateNextTestPanelId;
