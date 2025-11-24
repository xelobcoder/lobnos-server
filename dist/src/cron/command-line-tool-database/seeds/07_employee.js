const bcrypt = require("bcrypt");
exports.seed = async function (knex) {
    const superAdminPassword = await bcrypt.hash("TiifuHamza", 10);
    const adminPassword = await bcrypt.hash("admin", 10);
    return knex('roles').insert([
        {
            employeeid: 1,
            username: 'TIIFU HAMZA',
            role: 'admin',
            password: superAdminPassword,
            date_created: new Date(),
            time: new Date().getTime(),
            refresh_token: null,
            activation: 1,
            email: 'hamzatiifu45@gmail.com',
            permissions: '{}',
            updated_on: null,
            emailAuthenticated: 0,
            branch: null,
            pin: 1234,
            mobile: 595964565,
            alternativeMobile: null,
            dob: null,
        },
        {
            employeeid: 2,
            username: 'Lab Admin',
            role: 'admin',
            password: adminPassword,
            date_created: new Date(),
            time: new Date().getTime(),
            refresh_token: null,
            activation: 1,
            email: 'admin@lobnos.com',
            permissions: '{}',
            updated_on: null,
            emailAuthenticated: 0,
            branch: null,
            pin: 1234,
            mobile: 249434803,
            alternativeMobile: null,
            dob: null,
        }
    ]);
};
