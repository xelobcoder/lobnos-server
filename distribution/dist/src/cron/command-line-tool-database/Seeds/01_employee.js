"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt_1 = __importDefault(require("bcrypt"));
exports.seed = async function (knex) {
    const superAdminPassword = await bcrypt_1.default.hash("primelab", 10);
    const adminPassword = await bcrypt_1.default.hash("admin", 10);
    return knex('roles').insert([
        {
            username: 'super_admin',
            role: 'super-admin',
            password: superAdminPassword,
            date_created: new Date(),
            time: new Date().toTimeString().split(' ')[0],
            refresh_token: null,
            activation: 1,
            pin: 1234,
            email: 'hamzatiifu@gmail.com',
            permissions: JSON.stringify({
                registration: true,
                billing: true,
                inventory: true,
                supply: true,
                payments: true,
                approval: true,
                settings: true,
                phelobotomy: true
            }),
            updated_on: null,
            emailAuthenticated: 'true',
            branch: 1,
            mobile: '0595964565',
            alternativeMobile: null,
            dob: '1980-01-01'
        },
        {
            username: 'admin',
            role: 'admin',
            password: adminPassword,
            date_created: new Date(),
            time: new Date().toTimeString().split(' ')[0],
            refresh_token: null,
            activation: 1,
            email: 'admin@lobnos.com',
            permissions: JSON.stringify({
                registration: true,
                billing: true,
                inventory: true,
                supply: true,
                payments: true,
                approval: true,
                settings: true,
                phelobotomy: true
            }),
            updated_on: null,
            emailAuthenticated: 'true',
            branch: 1,
            pin: 1234,
            mobile: '0249434803',
            alternativeMobile: null,
            dob: '1985-05-15'
        }
    ]);
};
