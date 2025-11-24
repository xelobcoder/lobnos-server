exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('samplecontainer').del()
    .then(function () {
      // Inserts seed entries
      return knex('samplecontainer').insert([
        {
          name: 'Red Vacutainer',
          description: 'Standard blood collection tube',
          volume_capacity: 5.0,
          material: 'Plastic',
          color: 'Red',
          is_reusable: false
        },
        {
          name: 'Blue Vacutainer',
          description: 'Coagulation tube',
          volume_capacity: 2.7,
          material: 'Plastic',
          color: 'Blue',
          is_reusable: false
        },
        {
          name: 'Sterile Urine Cup',
          description: 'For urine sample collection',
          volume_capacity: 100.0,
          material: 'Polypropylene',
          color: 'Clear',
          is_reusable: false
        },
        {
          name: 'Reusable Specimen Container',
          description: 'For various sample types',
          volume_capacity: 50.0,
          material: 'Polycarbonate',
          color: 'White',
          is_reusable: true
        }
      ]);
    });
};