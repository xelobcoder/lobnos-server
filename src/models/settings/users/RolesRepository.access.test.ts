import {describe,it,expect,vi} from 'vitest';
import {transactionalDatabase} from '../../../testSupport/transactionalDatabase';
const mocks=vi.hoisted(()=>({db:null as any}));
vi.mock('../../../database/KnexConnections',()=>({default:()=>mocks.db}));
import RolesRepository from './RolesRepository';
describe('legacy staff editor with multi-role accounts',()=>{
 it.each(['cashier','Cashier',' cashier ','pharmacy_cashier'])('accepts %s without merging billing and pharmacy cashier roles',async(role)=>{
  const insert=vi.fn((_row:any)=>({returning:async()=>[42]}));mocks.db=()=>({insert});
  const repo=new RolesRepository(2);
  await expect(repo.createRole({username:'Cashier test',role:role as any,password:'hashed-password',email:'cashier@example.test',pin:'1234',mobile:'0200000000',activation:1,emailAuthenticated:'1'})).resolves.toBe(42);
  expect(insert.mock.calls[0][0].role).toBe(role==='pharmacy_cashier'?'pharmacy_cashier':'cashier');
 });
 it('still rejects unsupported roles before writing an account',async()=>{
  const insert=vi.fn();mocks.db=()=>({insert});
  await expect(new RolesRepository(2).createRole({username:'Test',role:'unsupported' as any} as any)).rejects.toThrow('Invalid role');
  expect(insert).not.toHaveBeenCalled();
 });
 const fixture=(assigned=false)=>{const f=transactionalDatabase({roles:[{employeeid:1,role:'admin',branch:1,activation:1,access_revision:0}],staff_role_access:assigned?[{id:'original',employeeid:1,role:'admin',branchid:1}]:[]});mocks.db=f.db;return {...f,repo:new RolesRepository(2)};};
 it('does not let the single-role editor leave contradictory canonical assignments',async()=>{const f=fixture(true);await expect(f.repo.updateRole(1,{role:'scientist'})).rejects.toThrow('Staff & role access');expect(f.rows('roles')[0].role).toBe('admin');});
 it('keeps non-access profile edits compatible',async()=>{const f=fixture(true);await f.repo.updateRole(1,{username:'Updated name'});expect(f.rows('roles')[0]).toMatchObject({username:'Updated name',role:'admin',access_revision:0});});
 it('invalidates old sessions when a legacy single-role account changes role or activation',async()=>{const f=fixture();await f.repo.updateRole(1,{role:'scientist'});expect(f.rows('roles')[0]).toMatchObject({role:'scientist',access_revision:1});await f.repo.updateRole(1,{activation:0});expect(f.rows('roles')[0]).toMatchObject({activation:0,access_revision:2});});
});
