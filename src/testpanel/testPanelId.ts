import {masterCatalogContext} from '../models/system-admin/MasterCatalogContext';
export async function generateNextTestPanelId(db: any): Promise<string> {
	const master = masterCatalogContext.getStore();
	if (master) await db('master_catalog_sequences').where({key:'write_lock'}).forUpdate().first();
	const raw = await db.raw(
		"SELECT MAX(CAST(SUBSTRING(id, 4) AS UNSIGNED)) AS max_id FROM test_panels WHERE id REGEXP '^100[0-9]+$' FOR UPDATE"
	);

	const rows = Array.isArray(raw) ? raw[0] : raw?.[0] ?? raw;
	const firstRow = Array.isArray(rows) ? rows[0] : rows;
	const maxId = firstRow && typeof firstRow.max_id !== "undefined" ? Number(firstRow.max_id) : NaN;

	let next = Number.isFinite(maxId) ? maxId + 1 : 101;
	if (master) {
		const saved = await db('master_catalog_sequences').where({key:'test_panels.id'}).first();
		const highWater = String(saved?.value || '');
		if (/^100[0-9]+$/.test(highWater)) next = Math.max(next, Number(highWater.slice(3)) + 1);
	}
	for (let i = 0; i < 50; i++) {
		const candidate = `100${next}`;
		const exists = await db("test_panels").select("id").where({ id: candidate }).first();
		if (!exists) {
			if (master) await db('master_catalog_sequences').insert({key:'test_panels.id',value:Number(candidate)}).onConflict('key').merge({value:Number(candidate)});
			return candidate;
		}
		next++;
	}

	throw new Error("unable to generate test panel id");
}

