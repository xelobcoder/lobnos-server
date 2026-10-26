import {afterEach,describe,it,expect,vi} from 'vitest';
import jwt from 'jsonwebtoken';
vi.mock('../../database/KnexConnections',()=>({default:()=>Promise.resolve({})}));
import AuthenticationRepository from '../settings/users/AuthenticationRepository';
afterEach(()=>{vi.unstubAllEnvs();vi.useRealTimers();});
describe('role-recovery access-token lifetime',()=>{
 it('can issue the current role revision without extending the original token deadline',async()=>{
  vi.stubEnv('ACCESS_TOKEN_SECRET','test-role-recovery-signing-key');vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
  const token=await new AuthenticationRepository(2).generateAccessToken('staff@example.test',{employeeid:1,tid:2,sid:'existing-session',arv:2},60);
  const claims=jwt.verify(token,'test-role-recovery-signing-key') as jwt.JwtPayload;
  expect(claims).toMatchObject({employeeid:1,tid:2,sid:'existing-session',arv:2});expect(claims.exp).toBe(Math.floor(Date.now()/1000)+60);
 });
 it('keeps the existing three-hour login token default and rejects invalid recovery lifetimes',async()=>{
  vi.stubEnv('ACCESS_TOKEN_SECRET','test-role-recovery-signing-key');const repo=new AuthenticationRepository(2);
  const claims=jwt.verify(await repo.generateAccessToken('staff@example.test'),'test-role-recovery-signing-key') as jwt.JwtPayload;
  expect(Number(claims.exp)-Number(claims.iat)).toBe(10800);
  for(const lifetime of [0,-1,10801,NaN,1.5])await expect(repo.generateAccessToken('staff@example.test',{},lifetime)).rejects.toThrow('lifetime');
 });
});
