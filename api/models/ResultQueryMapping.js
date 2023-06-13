const bloodgrouping = `SELECT * FROM BLOODGROUP WHERE billingid = `;

const malaria = `SELECT * FROM MALARIA WHERE BILLINGID =`;

const widal = `SELECT * FROM result_widal WHERE BILLINGID =`;

const mappWithBilingid = function (query, value) { return query += ` ${value}` }






const MappingSetup = {
  blood_grouping: bloodgrouping,
  malaria,
  widal
}


// this category mapping is used to determine which function to use to return data for test 
// printing and the category dosent represent the pathological category of test

const testCategoryMapping = {
  liver_function_test: 'chemistry',
  widal: 'hema',
  malaria: 'hema',
  cardiac_enzymes: 'chemistry',
  renal_function_test: 'chemistry',
  blood_grouping: 'hema'
}

module.exports = { MappingSetup, mappWithBilingid,testCategoryMapping }