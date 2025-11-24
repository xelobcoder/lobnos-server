exports.seed = async function (knex) {
     return knex('sampletype').insert([
          { id: 1, name: 'urine', addedon: new Date() },
          { id: 2, name: 'blood', addedon: new Date() },
          { id: 3, name: 'serum', addedon: new Date() },
          { id: 4, name: 'stool', addedon: new Date() },
          { id: 5, name: 'cerebrospinal fluid', addedon: new Date() },
          { id: 7, name: 'Faeces', addedon: new Date() },
          { id: 8, name: 'none', addedon: new Date() },
     ]);
};