import 'reflect-metadata';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { validateDtoMiddleware } from './validateDto.middleware';
import { CreateTestConditionDefinitionDto } from '../models/operations/dto/MultiDefinitions.dto';

class SampleDto {
     @IsString()
     @IsNotEmpty()
     name!: string;
}

class EmployeeScopedDto {
     @IsInt()
     employeeid!: number;
}

function response() {
     return {
          statusCode: 200,
          body: null as any,
          status(code: number) { this.statusCode = code; return this; },
          json(payload: any) { this.body = payload; return this; },
     };
}

function request(body: any, authUser?: any) {
     return { body, authUser } as any;
}

describe('validateDtoMiddleware', () => {
     it('ignores an employeeid that matches the verified session actor', async () => {
          const req = request({ name: 'Glucose', employeeid: 7 }, { employeeid: 7, tenantId: 1, role: 'admin' });
          const res = response();
          let nextCalled = false;
          await validateDtoMiddleware(SampleDto, 'body')(req, res, () => { nextCalled = true; });
          expect(nextCalled).toBe(true);
          expect(res.statusCode).toBe(200);
          expect(req.body).toBeInstanceOf(SampleDto);
          expect(req.body.name).toBe('Glucose');
          expect('employeeid' in req.body).toBe(false);
     });

     it('rejects a client-supplied employeeid that differs from the session', async () => {
          const req = request({ name: 'Glucose', employeeid: 99 }, { employeeid: 7, tenantId: 1, role: 'admin' });
          const res = response();
          let nextCalled = false;
          await validateDtoMiddleware(SampleDto, 'body')(req, res, () => { nextCalled = true; });
          expect(nextCalled).toBe(false);
          expect(res.statusCode).toBe(400);
          expect(String(res.body.message)).toContain('employeeid');
     });

     it('rejects employeeid on an unauthenticated DTO route', async () => {
          const req = request({ name: 'Glucose', employeeid: 7 });
          const res = response();
          let nextCalled = false;
          await validateDtoMiddleware(SampleDto, 'body')(req, res, () => { nextCalled = true; });
          expect(nextCalled).toBe(false);
          expect(res.statusCode).toBe(400);
     });

     it('leaves ordinary bodies unchanged', async () => {
          const req = request({ name: 'Glucose' }, { employeeid: 7, tenantId: 1, role: 'admin' });
          const res = response();
          let nextCalled = false;
          await validateDtoMiddleware(SampleDto, 'body')(req, res, () => { nextCalled = true; });
          expect(nextCalled).toBe(true);
          expect(req.body.name).toBe('Glucose');
     });

     it('does not strip employeeid when the DTO declares it', async () => {
          const req = request({ employeeid: 7 }, { employeeid: 7, tenantId: 1, role: 'admin' });
          const res = response();
          let nextCalled = false;
          await validateDtoMiddleware(EmployeeScopedDto, 'body')(req, res, () => { nextCalled = true; });
          expect(nextCalled).toBe(true);
          expect(req.body.employeeid).toBe(7);
     });

     it('accepts the real test-condition DTO with a platform-injected employeeid', async () => {
          const req = request(
               { conditionName: 'Fasting', testid: 100107, createdBy: 7, employeeid: 7 },
               { employeeid: 7, tenantId: 1, role: 'admin' },
          );
          const res = response();
          let nextCalled = false;
          await validateDtoMiddleware(CreateTestConditionDefinitionDto, 'body')(req, res, () => { nextCalled = true; });
          expect(nextCalled).toBe(true);
          expect(req.body).toMatchObject({ conditionName: 'Fasting', testid: 100107, createdBy: 7 });
          expect('employeeid' in req.body).toBe(false);
     });
});
