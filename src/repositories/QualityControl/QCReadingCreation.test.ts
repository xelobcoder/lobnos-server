import { expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({connect:vi.fn(),insert:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:state.connect}));
import { QCReadingsRepository } from './QCReadingsRepository';
it('treats a successful UUID reading insert with insertId zero as success',async()=>{const now=new Date();const db:any=(table:string)=>{const q:any={where:()=>q,first:async()=>({id:'session-1'}),insert:state.insert};return q};db.fn={now:()=>now};state.insert.mockResolvedValue([0]);state.connect.mockResolvedValue(db);expect(await new QCReadingsRepository(3).create({sessionId:'session-1',parameter:'Hb',value:'12.5',status:'normal',createdby:7,parameterId:1})).toBe(true);expect(state.insert).toHaveBeenCalledWith(expect.objectContaining({value:'12.5',createdAt:now,id:expect.any(String)}))});
