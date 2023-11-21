const testTable = {
  hepatitisb: "hepatitisBresult",
  hepatitisc: "hepatitisCresult",
  blood_grouping: "bloodgroup",
  glycated_haemoglobin: "glycated_haemoglobin",
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
  prostate_specific_antigen_test: 'psaresult'
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


const setups = {
  liver_function_test: LIVER_SETUP,
  renal_function_test: RENAL_SETUP,
  cardiac_enzymes: CARDIAC_ENZYMES,
  full_blood_count: '',
  LHHORMONE,
  FSHHORMONE
};


const PDF_QUERIES = {
  chemistryQ: function (testname, setupname, billingid) {
    return `SELECT t.parameter,s.upper,s.lower,t.unit,CAST(t.created_on AS DATE) AS date,CAST(t.created_on AS time) AS time,
    t.value,t.patientid FROM ${testname} AS t INNER JOIN ${setupname} AS s ON s.parameter = t.parameter WHERE t.billingid = ${billingid}`
  }
}

module.exports = { testTable, setups, PDF_QUERIES }