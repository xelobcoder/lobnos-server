import bcrypt from "bcrypt";

exports.seed = async function (knex) {
     const superAdminPassword = await bcrypt.hash("primelab", 10);
     const adminPassword = await bcrypt.hash("admin", 10);

     return knex('roles').insert([
          {
               username: 'super_admin',
               role: 'super-admin',
               password: superAdminPassword,
               date_created: new Date(),
               time: new Date(), // roles.time is datetime(6), not a bare HH:MM:SS string
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
               time: new Date(),
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