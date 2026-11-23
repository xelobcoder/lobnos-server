import KnexConnection from '../../database/KnexConnections';

const config = 'pls_test_instrument_config';
const mappings = 'pls_test_instruments';
const history = 'pls_test_instrument_history';
const fail = (message: string, statusCode = 400): never => { throw Object.assign(new Error(message), { statusCode }); };
const id = (value: unknown) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const deviceId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 36 && value.trim() === value;

export class TestInstrumentMapping {
     constructor(private tenantId: number) {}

     async list(page: number, count: number, search: string) {
          const db = await KnexConnection(this.tenantId);
          const query = () => db('test_panels as t').leftJoin(`${config} as c`, 'c.testid', 't.id')
               .where('t.name', 'like', `%${search}%`);
          const total = await query().count({ total: 't.id' }).first();
          const rows = await query().select('t.id', 't.name', 'c.mode', 'c.version').orderBy('t.name')
               .limit(count).offset((page - 1) * count);
          const ids = rows.map((row: any) => row.id);
          const devices = ids.length ? await db(`${mappings} as m`).join('devices as d', 'd.id', 'm.device_id')
               .whereIn('m.testid', ids).select('m.testid', 'd.id', 'd.deviceName', 'd.status') : [];
          return { data: rows.map((row: any) => ({ ...row, version: Number(row.version || 0),
               devices: devices.filter((d: any) => Number(d.testid) === Number(row.id)) })), total: Number(total?.total || 0), page, count };
     }

     async history(testid: number, page: number, count: number) {
          if (!id(testid)) fail('Invalid test');
          const db = await KnexConnection(this.tenantId);
          const total = await db(history).where({ testid }).count({ total: 'id' }).first();
          const data = await db(history).where({ testid }).orderBy('id', 'desc').limit(count).offset((page - 1) * count);
          return { data, total: Number(total?.total || 0), page, count };
     }

     async save(testid: number, actor: number, input: any) {
          if (!id(testid) || !id(actor)) fail('Invalid test or actor');
          const mode = input?.mode;
          const reason = typeof input?.reason === 'string' ? input.reason.trim() : '';
          const version = input?.version;
          const devices = input?.deviceIds;
          if (!['manual', 'instrument'].includes(mode) || !reason || reason.length > 1000 ||
               !Number.isSafeInteger(version) || version < 0 || !Array.isArray(devices) ||
               devices.length > 200 || devices.some((v: unknown) => !deviceId(v)) ||
               new Set(devices).size !== devices.length || (mode === 'manual' && devices.length) ||
               (mode === 'instrument' && !devices.length)) fail('Invalid mode, version, reason or instruments');
          const db = await KnexConnection(this.tenantId);
          return db.transaction(async trx => {
               // Also acquired by the guard: serializes creation and updates, including absent config.
               if (!await trx('test_panels').where({ id: testid }).forUpdate().first('id')) fail('Test not found', 404);
               const previous = await trx(config).where({ testid }).first();
               if (Number(previous?.version || 0) !== version) fail('Mapping changed; reload before saving', 409);
               const priorDevices = await trx(mappings).where({ testid }).orderBy('device_id').pluck('device_id');
               if (devices.length) {
                    const active = await trx('devices').whereIn('id', devices).where({ status: 'active' }).forUpdate().pluck('id');
                    if (active.length !== devices.length) fail('All selected instruments must exist and be active');
               }
               const before = previous ? { mode: previous.mode, version: Number(previous.version), deviceIds: priorDevices } : null;
               const after = { mode, version: version + 1, deviceIds: [...devices].sort() };
               if (previous) await trx(config).where({ testid }).update({ mode, version: after.version });
               else await trx(config).insert({ testid, mode, version: after.version });
               await trx(mappings).where({ testid }).delete();
               if (devices.length) await trx(mappings).insert(devices.map((device_id: string) => ({ testid, device_id })));
               await trx(history).insert({ testid, actor_id: actor, reason, before_data: before ? JSON.stringify(before) : null, after_data: JSON.stringify(after) });
               return after;
          });
     }
}

/**
 * A plain Knex connection is accepted for read-only preflight (e.g. print preview).
 * Writes and final release/print authorization must pass their existing transaction so
 * locks persist until the operation commits. Assignment writes must acquire the same
 * ordered-test lock before checking existing results.
 */
export async function assertTestInstrumentEligible(db: any, ascensionid: number): Promise<void> {
     if (!db?.isTransaction) {
          if (typeof db?.transaction !== 'function') throw new Error('A Knex connection or transaction is required');
          await db.transaction((trx: any) => assertTestInstrumentEligible(trx, ascensionid));
          return;
     }
     const trx = db;
     if (!id(ascensionid)) fail('Invalid ordered test');
     const order = await trx('test_ascension').where({ id: ascensionid }).forUpdate().first('id', 'testid');
     if (!order) fail('Ordered test not found', 404);
     const testid = Number(order.testid);
     if (!await trx('test_panels').where({ id: testid }).forUpdate().first('id')) fail('Test not found', 409);
     const current = await trx(config).where({ testid }).first();
     if (!current) return;
     const work = await trx('lab_work_assignments').where({ ascensionid }).forUpdate().first('device_id');
     const selected = work?.device_id || null;
     if (current.mode === 'manual') {
          if (selected) fail('This test is configured for manual processing only', 409);
          return;
     }
     if (current.mode !== 'instrument') fail('Invalid instrument mapping configuration', 409);
     if (!selected || !await trx(`${mappings} as m`).join('devices as d', 'd.id', 'm.device_id')
          .where({ 'm.testid': testid, 'm.device_id': selected, 'd.status': 'active' }).first('m.device_id'))
          fail('Select an active eligible instrument for this test', 409);
}
