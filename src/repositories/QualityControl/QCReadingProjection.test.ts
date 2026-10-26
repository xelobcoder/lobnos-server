import { expect, it, vi } from 'vitest';
import knex from 'knex';
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
import connect from '../../database/KnexConnections';
import { QCReadingsRepository } from './QCReadingsRepository';
it('keeps recorded reading identity/value separate from the parameter target',async()=>{const db=knex({client:'mysql2'}),queries:any[]=[];vi.spyOn(db.client,'runner').mockImplementation((builder:any)=>({run:async()=>{queries.push(builder.toSQL());return[]}}) as any);vi.mocked(connect).mockResolvedValue(db);const repo=new QCReadingsRepository(3);await repo.findBySessionId('session-1');await repo.findBySessionAndControlId('session-1','control-1');for(const query of queries){expect(query.sql).toContain('`qr`.*');expect(query.sql).not.toContain('`cp`.*');expect(query.sql).toContain('`cp`.`value` as `mean`');expect(query.bindings).toContain('session-1')}});
