const bcrypt = require("bcrypt");
exports.seed = async function (knex) {
    await knex('roles').del();
    const password = await bcrypt.hash("TiifuHamza", 10);
    return knex('roles').insert([
        {
            username: 'TIIFU HAMZA',
            role: 'admin',
            password,
            date_created: new Date(),
            time: new Date().getTime(),
            refresh_token: null,
            activation: 1,
            email: 'hamzatiifu45@gmail.com',
            permissions: '{}',
            updated_on: null,
            emailAuthenticated: 0,
            branch: null,
            mobile: 595964565,
            alternativeMobile: null,
            dob: null,
        },
    ]);
};
