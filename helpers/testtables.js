const testTable = {
  hepatitis_b: "hepatitisBresult",
  hepatitis_c: "hepatitisCresult",
  blood_grouping: "bloodgroup",
  glycated_heamoglobin: "glycated_haemoglobin",
  urinalysis: "urinalysisresult",
  cardiac_enzymes: "result_cardiac_enzymes",
  pregnancy_test: "result_pregnancy_test",
  thyroid_functional_test: "result_thyroid_functional_test",
  malaria: "malaria",
  hepatitis_b_profile: "hepatitisb_profile",
  widal: "result_widal",
  betahcg: "result_beta_hcg",
  aids: "result_aids",
  liver_function_test: "result_function_liver",
  renal_function_test: 'result_function_renal',
  esr: "result_esr",
  random_blood_sugar: "result_random_blood_sugar",
  fasting_blood_sugar: "result_fasting_blood_sugar",
  full_blood_count: 'result_function_full_blood_count',
  haemoglobin_electrophoresis: 'result_haemoglobin_electrophoresis',
  semen_analysis: 'semenAnalysis',
  luteinizing_hormone: 'lhresult',
  follicle_stimulating_hormone: 'fshresult',
  lipid_profile: 'result_lipid_profile',
  helicobacter_pylori: 'result_helicobacter_pylori',
  scan: 'scanReport',
  prostate_specific_antigen_test: 'psaresult',
  syphilis: 'syphilis',
  clotting_and_bleeding_time: 'clotbleedingtime',
  stool_analysis: 'stoolanalysisResult',
  beta_thalassemia: 'betathalassemia'
};

const LIVER_SETUP = "setup_liver_function_test";
const RENAL_SETUP = "setup_renal_function_test";
const CARDIAC_ENZYMES = "setup_cardiac_enzymes";
const THYROID_SETUP = "setup_thyroid_test";
const LIPID_PROFILE_SETUP = "setup_lipid_profile_test";
const FULL_BLOOD_COUNT = 'result_function_full_blood_count'
const BETAHCG = `setup_beta_hcg`;
const ESR = `setup_esr`;
const LHHORMONE = 'lhsetup';
const FSHHORMONE = 'fshsetup';
const bloodCulture = 'bloodcultureandsensitivitytestsetup';
const HAEMOGLOBIN_ELECTROPHORESIS = 'haemoglobinelectrophoresis';
const PSAHORMONE = 'psasetup'
const BLOODCULTURE = 'bloodcultureandsensitivitytestsetup';
const GLUCOSE = 'setupglucose';
const BETATHALASSEMIA = 'setupbetathalassemia';

const setups = {
  liver_function_test: LIVER_SETUP,
  renal_function_test: RENAL_SETUP,
  cardiac_enzymes: CARDIAC_ENZYMES,
  full_blood_count: FULL_BLOOD_COUNT,
  luteinizing_hormone: LHHORMONE,
  follicle_stimulating_hormone: FSHHORMONE,
  thyroid_functional_test: THYROID_SETUP,
  lipid_profile: LIPID_PROFILE_SETUP,
  betahcg: BETAHCG,
  haemoglobin_electrophoresis: HAEMOGLOBIN_ELECTROPHORESIS,
  blood_culture_and_sensitivity_test: bloodCulture,
  prostate_specific_antigen_test: PSAHORMONE,
  esr: ESR,
  bloodCulture: BLOODCULTURE,
  random_blood_sugar: GLUCOSE,
  fasting_blood_sugar: GLUCOSE,
  beta_thalassemia: BETATHALASSEMIA
};


const PDF_QUERIES = {
  chemistryQ: function (testname, setupname, billingid) {
    return `SELECT t.parameter,s.upper,s.lower,t.unit,CAST(t.created_on AS DATE) AS date,CAST(t.created_on AS time) AS time,
    t.value,t.patientid FROM ${testname} AS t INNER JOIN ${setupname} AS s ON s.parameter = t.parameter WHERE t.billingid = ${billingid}`
  },
  hematologicalQ: function (testname) {
    return `SELECT * FROM ${testname} WHERE billingid = ?`;
  },
  getPatientid: `SELECT patientid FROM billing WHERE billingid = ?`
  ,
  endrinologyQ: function (testname, setupname, billingid, gender) {
    return `SELECT t.parameter,s.upper,s.lower,t.unit,CAST(t.created_on AS DATE) AS date,CAST(t.created_on AS time) AS time,
    t.value,t.patientid FROM ${testname} AS t INNER JOIN ${setupname} AS s ON s.parameter = t.parameter WHERE t.billingid = ${billingid} 
    AND s.gender = '${gender}'`;
  },
  glucoseQ: function (testname,table,setupname) { 
    let query = `SELECT * FROM ${table} INNER JOIN ${setupname}`;

    if (testname === 'random_blood_sugar') {
      query += ` WHERE parameter = 'random blood sugar'`
    }

    if (testname === 'fasting_blood_sugar') {
      query += ` WHERE parameter = 'fasting blood sugar'`
    }

    query += `AND billingid  = ?`;

    return query;
  }
}



const PatientQueries = {
  chemistryTrend: function (testname, list, setuptable) {
    return ` SELECT rf.parameter,rf.billingid,rf.value,rf.created_on,st.upper,st.lower,st.unit  FROM ${testname} AS rf INNER JOIN ${setuptable} AS st ON st.parameter = rf.parameter WHERE billingid IN (${list})`
  },
  getBillings: function (testname, patientid, instance) {
    return `SELECT DISTINCT billingid FROM ${testname} WHERE patientid =  ? LIMIT ?`
  },
  getFbcTrend: function (gender, age, agetype) {
    if (gender == 'male' && agetype == 'years' && parseInt(age) > 12) {
      return `SELECT * FROM result_function_full_blood_count AS rf INNER JOIN setup_full_blood_count_test_male AS st ON st.parameter = rf.parameter WHERE rf.patientid = ? ORDER BY rf.created_on DESC`
    } else if (gender == 'female' && agetype == 'years' && parseInt(age) > 12) {
      return `SELECT * FROM result_function_full_blood_count AS rf INNER JOIN setup_full_count_count_female AS st ON st.parameter = rf.parameter WHERE rf.patientid = ? ORDER BY rf.created_on DESC`
    } else {
      return `SELECT * FROM result_function_full_blood_count AS rf INNER JOIN setup_full_blood_count_test_general AS st ON st.parameter = rf.parameter WHERE rf.patientid = ? ORDER BY rf.created_on DESC`
    }
  }
}

module.exports = { testTable, setups, PDF_QUERIES, PatientQueries }