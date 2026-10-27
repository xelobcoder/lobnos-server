import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({connect:vi.fn(),read:vi.fn(),save:vi.fn()}));
vi.mock('../../database/KnexConnections',()=>({default:mocks.connect}));
vi.mock('../../models/organization/OrganizationLogoStore',()=>({OrganizationLogoStore:class{read=mocks.read;save=mocks.save}}));
vi.mock('multer',()=>{const factory:any=()=>({single:()=> (_req:any,_res:any,callback:any)=>callback()});factory.memoryStorage=()=>({});return{default:factory}});
import {getOrganizationLogo,uploadOrganizationLogo} from './logoHandlers';
const response=()=>{const res:any={status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis(),setHeader:vi.fn(),type:vi.fn().mockReturnThis(),send:vi.fn()};return res};
const request=(tenant=1)=>({query:{id:'4',tenantId:'999'},authUser:{tenantId:tenant,employeeid:7,role:'admin',branch:2},file:{buffer:Buffer.from('image')}} as any);
describe('organization logo request identity',()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.connect.mockResolvedValue(()=>({where:()=>({first:async()=>({id:4})})}));mocks.read.mockResolvedValue({bytes:Buffer.from('png'),mediaType:'image/png'});mocks.save.mockResolvedValue(undefined)});
 it('uses the authenticated tenant, never the URL tenant, when reading the logo',async()=>{const res=response();await getOrganizationLogo(request(2),res,vi.fn());expect(mocks.connect).toHaveBeenCalledWith(2);expect(mocks.read).toHaveBeenCalledWith(2,4);expect(res.setHeader).toHaveBeenCalledWith('Cache-Control','private, no-store');expect(res.type).toHaveBeenCalledWith('image/png')});
 it('uses the authenticated tenant and organization for replacement uploads',async()=>{const res=response();await uploadOrganizationLogo(request(2),res,vi.fn());await vi.waitFor(()=>expect(res.json).toHaveBeenCalledWith(expect.objectContaining({status:true})));expect(mocks.save).toHaveBeenCalledWith(2,4,expect.any(Buffer))});
 it('does not read files for an unauthenticated or invalid-ID request',async()=>{for(const req of [{query:{id:'4'}},{...request(),query:{id:'../4'}}]){await getOrganizationLogo(req as any,response(),vi.fn())}expect(mocks.read).not.toHaveBeenCalled();expect(mocks.connect).not.toHaveBeenCalled()});
 it('does not read files for an organization absent from this tenant',async()=>{mocks.connect.mockResolvedValue(()=>({where:()=>({first:async()=>undefined})}));const res=response();await getOrganizationLogo(request(),res,vi.fn());expect(res.status).toHaveBeenCalledWith(404);expect(mocks.read).not.toHaveBeenCalled()});
 it('returns a definite not-found response when no logo has been uploaded',async()=>{mocks.read.mockResolvedValue(null);const res=response();await getOrganizationLogo(request(),res,vi.fn());expect(res.status).toHaveBeenCalledWith(404);expect(res.json).toHaveBeenCalledWith(expect.objectContaining({status:false}))});
});
