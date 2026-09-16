exports.seed = async function (knex) {
     // Disable foreign key checks to allow deletion
     await knex.raw('SET FOREIGN_KEY_CHECKS = 0');

     // Delete all rows from tables first
     await knex('branch').del();
     await knex("departments").del();
     await knex('roles').del();
     await knex('regions').del();
     await knex('districts').del();
     await knex('paymentmodes').del();
     await knex('sampletype').del();
     await knex('registrationsettings').del();
     await knex("test_panels").del();
     await knex('testcreationrules').del();
     await knex("testdetails").del();

     // Then alter auto-increment for all tables
     await knex.raw('ALTER TABLE branch AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE departments AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE roles AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE regions AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE districts AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE paymentmodes AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE sampletype AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE registrationsettings AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE test_panels AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE testcreationrules AUTO_INCREMENT = 1');
     await knex.raw('ALTER TABLE testdetails AUTO_INCREMENT = 1');

     // Re-enable foreign key checks
     await knex.raw('SET FOREIGN_KEY_CHECKS = 1');

     return knex('branch').insert([
          {
               name: 'PrimeLabSystem',
               date: new Date(),
               activation: 1,
               address: '123 Main Street, Accra, Ghana',
               email: 'primelaboratorysystem@gmail.com',
               contact: 595964565, // branch.contact is int unsigned; country-code-prefixed value overflows it
               managerid: '1'
          }
     ]);
};
