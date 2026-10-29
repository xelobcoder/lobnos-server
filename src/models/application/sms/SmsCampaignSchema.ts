import { Knex } from 'knex';
import { randomBytes } from 'crypto';

export async function ensureSmsCampaignSchema(db: Knex): Promise<void> {
    for (const [table, column] of [['primesmsjobs', 'status'], ['primesmsjobrecipients', 'deliverystatus']]) {
        if (await db.schema.hasTable(table)) {
            const info: any = await db(table).columnInfo(column);
            if (String(info[column]?.type ?? info.type).startsWith('enum')) {
                await db.schema.alterTable(table, t => { t.string(column, 32).defaultTo(table === 'primesmsjobs' ? 'pending' : 'queued').alter(); });
            }
        }
    }
    if (!(await db.schema.hasTable('sms_campaign_dispatch'))) await db.schema.createTable('sms_campaign_dispatch', t => {
        t.integer('jobid').unsigned().primary();
        t.string('request_key', 64).unique().nullable();
        t.string('state', 24).notNullable().defaultTo('queued');
        t.dateTime('available_at').notNullable();
        t.dateTime('lease_until').nullable();
        t.string('lease_token', 64).nullable();
        t.string('callback_token', 64).notNullable();
        t.string('review_hash', 64).nullable();
        t.integer('branchid').unsigned().nullable();
        t.integer('cancelled_by').unsigned().nullable();
        t.dateTime('created_at').notNullable().defaultTo(db.fn.now());
        t.dateTime('updated_at').notNullable().defaultTo(db.fn.now());
        t.index(['state', 'available_at']);
    });
    // Earlier queue installations already have this table but predate reviewed
    // campaign fingerprints. Creation alone cannot upgrade those installations.
    if (!(await db.schema.hasColumn('sms_campaign_dispatch', 'review_hash'))) {
        await db.schema.alterTable('sms_campaign_dispatch', t => { t.string('review_hash', 64).nullable(); });
    }
    if (!(await db.schema.hasTable('sms_delivery_receipts'))) await db.schema.createTable('sms_delivery_receipts', t => {
        t.increments('id'); t.integer('jobid').unsigned().notNullable();
        t.string('messageid', 64).notNullable(); t.string('provider_status', 40).notNullable();
        t.dateTime('received_at').notNullable().defaultTo(db.fn.now());
        t.unique(['jobid', 'messageid', 'provider_status']);
    });
    if (await db.schema.hasTable('primesmsjobrecipients') && !(await db.schema.hasColumn('primesmsjobrecipients', 'last_checked_at'))) {
        await db.schema.alterTable('primesmsjobrecipients', t => { t.dateTime('last_checked_at').nullable().index(); });
    }
    // Existing untracked jobs predate submission claims. Their queued rows may
    // already have reached the provider: retain them for review, never replay them.
    if (await db.schema.hasTable('primesmsjobs')) {
        const legacy = await db('primesmsjobs as j').leftJoin('sms_campaign_dispatch as d', 'd.jobid', 'j.jobid')
            .leftJoin('roles as r', 'r.employeeid', 'j.createdby')
            .whereNull('d.jobid').whereIn('j.status', ['pending', 'processing']).select('j.jobid', 'r.branch as branchid');
        for (const row of legacy) await db.transaction(async trx => {
            await trx('sms_campaign_dispatch').insert({ jobid: row.jobid, state: 'completed', available_at: new Date(),
                branchid: row.branchid || null, callback_token: randomBytes(32).toString('hex') }).onConflict('jobid').ignore();
            await trx('primesmsjobrecipients').where({ jobid: row.jobid }).whereIn('deliverystatus', ['queued', 'retrying'])
                .update({ deliverystatus: 'unknown', errorcode: 'Legacy submission has no acceptance evidence; check provider' });
            await trx('primesmsjobs').where({ jobid: row.jobid }).update({ status: 'unknown' });
        });
    }
}
