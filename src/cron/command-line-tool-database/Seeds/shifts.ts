exports.seed = async function (knex) {
     await knex('shifts').del();
     const defaultShifts = [
          { name: 'Morning', color: '#FFA500', starttime: '08:00:00', endtime: '12:00:00' },
          { name: 'Afternoon', color: '#008000', starttime: '13:00:00', endtime: '17:00:00' },
          { name: 'Evening', color: '#0000FF', starttime: '18:00:00', endtime: '22:00:00' },
     ];
     await knex('shifts').insert(defaultShifts);
};
