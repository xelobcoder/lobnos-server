const bloodgrouping = `SELECT * FROM BLOODGROUP WHERE billingid = `

const malaria = `SELECT * FROM MALARIA WHERE BILLINGID =`

const widal = `SELECT * FROM result_widal WHERE BILLINGID =`

const urinalysis = `SELECT * FROM urinalysisresult WHERE BILLINGID =`

const hepatitis_b_profile = `SELECT * FROM HEPATITISB_PROFILE WHERE BILLINGID =`

const pregnancy_test = `SELECT * FROM RESULT_PREGNANCY_TEST WHERE BILLINGID =`

const esr = `SELECT * FROM result_esr WHERE BILLINGID =`

const hepatitisb =`SELECT * FROM hepatitisbresult WHERE BILLINGID =`

const hepatitisc = `SELECT * FROM hepatitiscresult WHERE BILLINGID =`;

const helicobacter_pylori = `SELECT * FROM result_helicobacter_pylori WHERE billingid =`;




const mappWithBilingid = function (query, value) {
  return (query += ` ${value}`)
}

const MappingSetup = {
  blood_grouping: bloodgrouping,
  malaria,
  widal,
  urinalysis,
  hepatitis_b_profile,
  pregnancy_test,
  esr,
  hepatitis_b:hepatitisb,
  hepatitis_c:hepatitisc,
  helicobacter_pylori
}

// this category mapping is used to determine which function to use to return data for test
// printing and the category dosent represent the pathological category of test

const testCategoryMapping = {
  liver_function_test: 'chemistry',
  widal: 'hema',
  malaria: 'hema',
  cardiac_enzymes: 'chemistry',
  renal_function_test: 'chemistry',
  blood_grouping: 'hema',
  urinalysis: 'hema',
  hepatitis_b_profile: 'hema',
  pregnancy_test: 'hema',
  hepatitis_b:'hema',
  hepatitis_c:'hema',
  full_blood_count: 'chemistry',
  esr: 'hema',
  helicobacter_pylori: 'hema'
}

module.exports = { MappingSetup, mappWithBilingid, testCategoryMapping }
