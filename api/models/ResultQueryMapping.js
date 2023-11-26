const bloodgrouping = `SELECT * FROM BLOODGROUP `

const malaria = `SELECT * FROM MALARIA`

const widal = `SELECT * FROM result_widal`

const urinalysis = `SELECT * FROM urinalysisresult`

const hepatitis_b_profile = `SELECT * FROM HEPATITISB_PROFILE`

const pregnancy_test = `SELECT * FROM RESULT_PREGNANCY_TEST`

const esr = `SELECT * FROM result_esr`

const hepatitisb =`SELECT * FROM hepatitisbresult`

const hepatitisc = `SELECT * FROM hepatitiscresult`;

const helicobacter_pylori = `SELECT * FROM result_helicobacter_pylori`;




const mappWithBilingid = function (query, value) {
  return (query += ` WHERE billingid = ${value}`)
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
  syphilis: 'syphilis',
  pregnancy_test: 'hema',
  hepatitis_b:'hema',
  hepatitis_c:'hema',
  full_blood_count: 'fbc',
  esr: 'hema',
  helicobacter_pylori: 'hema'
}

module.exports = { MappingSetup, mappWithBilingid, testCategoryMapping }
