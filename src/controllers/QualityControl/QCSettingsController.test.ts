import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../middleware/authority',()=>({getAuthUser:(req:any)=>req.authUser}));
vi.mock('../../database/KnexConnections',()=>({default:vi.fn()}));
import { QCSettingsRepository } from '../../repositories/QualityControl/QCSettingsRepository';
import { getQcSettings, saveQcSettings } from './QCSettingsController';
const response=()=>({status:vi.fn().mockReturnThis(),json:vi.fn(),setHeader:vi.fn()}) as any;
beforeEach(()=>vi.restoreAllMocks());
describe('QC defaults access',()=>{
 it.each(['scientist','patient','clinician'])('does not let %s change defaults',async role=>{const save=vi.spyOn(QCSettingsRepository.prototype,'save'),res=response();await saveQcSettings({authUser:{role,tenantId:3,employeeid:7},body:{warningLimit:2,actionLimit:3,revision:0}} as any,res);expect(res.status).toHaveBeenCalledWith(403);expect(save).not.toHaveBeenCalled()});
 it.each(['admin','manager'])('saves as authenticated %s rather than payload identity',async role=>{const save=vi.spyOn(QCSettingsRepository.prototype,'save').mockResolvedValue({warningLimit:2,actionLimit:4,revision:1}),res=response();await saveQcSettings({authUser:{role,tenantId:3,employeeid:7},query:{tenantId:99},body:{warningLimit:2,actionLimit:4,revision:0,updatedby:999}} as any,res);expect(save.mock.calls[0][1]).toBe(7);expect(res.json).toHaveBeenCalledWith({status:true,settings:{warningLimit:2,actionLimit:4,revision:1}})});
 it('requires authentication for reads and writes',async()=>{for(const handler of [getQcSettings,saveQcSettings]){const res=response();await handler({} as any,res);expect(res.status).toHaveBeenCalledWith(401)}});
 it('returns conflicts instead of silently overwriting defaults',async()=>{vi.spyOn(QCSettingsRepository.prototype,'save').mockRejectedValue(Error('QC settings changed. Reload before saving.'));const res=response();await saveQcSettings({authUser:{role:'admin',tenantId:3,employeeid:7},body:{warningLimit:2,actionLimit:3,revision:0}} as any,res);expect(res.status).toHaveBeenCalledWith(409)});
});
