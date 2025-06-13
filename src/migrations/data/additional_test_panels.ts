export interface ITestPanels {
  name: string,
  filename: string,
  category: number,
  price: number,
  [key: string]: any
}

const currentDate = new Date();

export const additionalTestPanels: ITestPanels[] = [
  { name: 'Blood Type & Rh Factor', filename: 'blood_type.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'Blood Type', iscustom: 1 },
  { name: 'D-Dimer', filename: 'ddimer.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'special tube', unit: 'mls', qty_required: 4, shorttext: 'D-Dimer', iscustom: 1 },
  { name: 'Ferritin', filename: 'ferritin.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'Ferritin', iscustom: 1 },
  { name: 'Cortisol', filename: 'cortisol.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'Cortisol', iscustom: 1 },
  { name: 'Procalcitonin', filename: 'procalcitonin.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'PCT', iscustom: 1 },
  { name: 'Troponin I', filename: 'troponin.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'TnI', iscustom: 1 },
  { name: 'NT-proBNP', filename: 'ntprobnp.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'BNP', iscustom: 1 },
  { name: 'Complement C3', filename: 'complement_c3.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'C3', iscustom: 1 },
  { name: 'Complement C4', filename: 'complement_c4.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'C4', iscustom: 1 },
  { name: 'Rheumatoid Factor', filename: 'rf.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'RF', iscustom: 1 },
  { name: 'Anti-CCP', filename: 'anti_ccp.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'CCP', iscustom: 1 },
  { name: 'Zinc', filename: 'zinc.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'Zn', iscustom: 1 },
  { name: 'Copper', filename: 'copper.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'Cu', iscustom: 1 },
  { name: 'Homocysteine', filename: 'homocysteine.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'special tube', unit: 'mls', qty_required: 4, shorttext: 'Hcy', iscustom: 1 },
  { name: 'Alpha-1 Antitrypsin', filename: 'a1at.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'AAT', iscustom: 1 },
  { name: 'Ceruloplasmin', filename: 'ceruloplasmin.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'Cp', iscustom: 1 },
  { name: 'Anti-Thyroid Peroxidase (Anti-TPO)', filename: 'anti_tpo.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'TPO', iscustom: 1 },
  { name: 'Anti-Thyroglobulin', filename: 'anti_tg.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'TG', iscustom: 1 },
  { name: 'Insulin Level', filename: 'insulin.json', category: 0, price: 0, created_on: currentDate, sample: 3, description: null, sample_container: 'gell tube', unit: 'mls', qty_required: 4, shorttext: 'Insulin', iscustom: 1 }
];