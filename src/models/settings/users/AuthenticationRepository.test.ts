import { afterEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import { accountingSqlDatabase } from '../../../testSupport/accountingSqlDatabase';

const mocks = vi.hoisted(() => ({ connection: vi.fn() }));
vi.mock('../../../database/KnexConnections', () => ({ default: mocks.connection }));

import AuthenticationRepository from './AuthenticationRepository';

describe('AuthenticationRepository.changePassword', () => {
     afterEach(() => vi.clearAllMocks());

     it('stores the new password date and revokes existing staff sessions', async () => {
          const { db } = accountingSqlDatabase();
          try {
               await db.schema.createTable('roles', table => {
                    table.integer('employeeid').primary();
                    table.string('password');
                    table.dateTime('password_changed_on').nullable();
                    table.dateTime('updated_on').nullable();
                    table.string('refresh_token').nullable();
                    table.integer('platform_support').defaultTo(0);
               });
               await db.schema.createTable('loginlogs', table => {
                    table.increments('id');
                    table.integer('employeeid');
                    table.boolean('loggedout').defaultTo(false);
                    table.dateTime('logoutTime').nullable();
                    table.dateTime('actualLogout').nullable();
               });
               await db('roles').insert({
                    employeeid: 7,
                    password: await bcrypt.hash('Current-Password-2026!', 4),
                    refresh_token: 'active-refresh-token',
               });
               await db('loginlogs').insert({ employeeid: 7, loggedout: false });
               mocks.connection.mockResolvedValue(db);

               await new AuthenticationRepository(1).changePassword(
                    7, 'Current-Password-2026!', 'New-Password-2026!',
               );

               const user = await db('roles').where({ employeeid: 7 }).first();
               const session = await db('loginlogs').where({ employeeid: 7 }).first();
               expect(await bcrypt.compare('New-Password-2026!', user.password)).toBe(true);
               expect(user.password_changed_on).toBeTruthy();
               expect(user.refresh_token).toBeNull();
               expect(session.loggedout).toBe(1);
          } finally {
               await db.destroy();
          }
     });

     it('rejects an incorrect current password without changing the stored hash', async () => {
          const { db } = accountingSqlDatabase();
          try {
               await db.schema.createTable('roles', table => {
                    table.integer('employeeid').primary();
                    table.string('password');
                    table.dateTime('password_changed_on').nullable();
                    table.dateTime('updated_on').nullable();
                    table.string('refresh_token').nullable();
                    table.integer('platform_support').defaultTo(0);
               });
               await db.schema.createTable('loginlogs', table => {
                    table.increments('id');
                    table.integer('employeeid');
                    table.boolean('loggedout').defaultTo(false);
                    table.dateTime('logoutTime').nullable();
                    table.dateTime('actualLogout').nullable();
               });
               const passwordHash = await bcrypt.hash('Current-Password-2026!', 4);
               await db('roles').insert({ employeeid: 7, password: passwordHash });
               mocks.connection.mockResolvedValue(db);

               await expect(new AuthenticationRepository(1).changePassword(
                    7, 'Wrong-Password-2026!', 'New-Password-2026!',
               )).rejects.toMatchObject({ statusCode: 401 });
               expect((await db('roles').where({ employeeid: 7 }).first()).password).toBe(passwordHash);
          } finally {
               await db.destroy();
          }
     });
});
