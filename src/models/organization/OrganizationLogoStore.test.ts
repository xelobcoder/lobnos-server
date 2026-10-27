import {describe,it,expect} from 'vitest';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {OrganizationLogoStore} from './OrganizationLogoStore';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
describe('organization logo isolation',()=>{
    it('isolates equal organization IDs across tenants and other organizations; replacement preserves their logos',async()=>{
        const base=path.resolve('tmp','organization-logo-tests');await mkdir(base,{recursive:true});const directory=await mkdtemp(path.join(base,'case-'));
        try { const store=new OrganizationLogoStore(directory);await store.save(1,4,png);await store.save(2,4,Buffer.concat([png,Buffer.from('tenant-two')]));await store.save(1,5,Buffer.concat([png,Buffer.from('other-org')]));await store.save(1,4,Buffer.concat([png,Buffer.from('updated')]));expect((await store.read(1,4)).bytes).toEqual(Buffer.concat([png,Buffer.from('updated')]));expect((await store.read(2,4)).bytes).toEqual(Buffer.concat([png,Buffer.from('tenant-two')]));expect((await store.read(1,5)).bytes).toEqual(Buffer.concat([png,Buffer.from('other-org')]));expect(await store.read(3,4)).toBeNull(); }
        finally { if(!path.resolve(directory).startsWith(base+path.sep))throw Error('Unsafe test cleanup');await rm(directory,{recursive:true,force:true}); }
    });
    it('rejects traversal, invalid files and oversized uploads before writing',async()=>{const store=new OrganizationLogoStore(path.resolve('tmp','organization-logo-invalid'));await expect(store.save(1,'../4' as any,png)).rejects.toThrow('Invalid');await expect(store.save(1,4,Buffer.from('<svg/>'))).rejects.toThrow('PNG or JPEG');await expect(store.save(1,4,Buffer.alloc(5*1024*1024+1))).rejects.toThrow('5 MB');});
});
