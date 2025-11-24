const data = [
     {
          name: 'Complete Blood Count',
          filepath: './creationrules/complete-blood-count.json'
     },
     {
          name: 'Liver Function Test',
          filepath: './creationrules/liver-function-test.json'
     },
     {
          name: 'Renal Function Test',
          filepath: './creationrules/renal-function-test.json'
     },
     {
          name: 'Lipid Profile',
          filepath: './creationrules/lipid-profile.json'
     },
     {
          name: 'Lipid Profile with Lipoprotein Electrophoresis',
          filepath: './creationrules/lipid-profile-extended.json'
     },
     {
          name: 'Blood Group (ABO & RH)',
          filepath: './creationrules/blood-group-abo-rh.json'
     },
     {
          name: 'Hb Electrophoresis',
          filepath: './creationrules/hb-electrophoresis.json'
     },
     {
          name: 'Coombs Direct',
          filepath: './creationrules/coombs-direct.json'
     },
     {
          name: 'Coombs Indirect',
          filepath: './creationrules/coombs-indirect.json'
     },
     {
          name: 'G6PD',
          filepath: './creationrules/g6pd.json'
     },
     {
          name: 'Sickling',
          filepath: './creationrules/sickling.json'
     },
     {
          name: 'HbA1c (Glycated Hemoglobin)',
          filepath: './creationrules/hba1c-glycated-hemoglobin.json'
     },
     {
          name: 'Cardio C-Reactive Protein',
          filepath: './creationrules/cardio-c-reactive-protein.json'
     },
     {
          name: 'Full Blood Count Adult Male',
          filepath: './creationrules/fbcadultmale.json'
     },
     {
          name: 'Full Blood Count(Children)',
          filepath: './creationrules/fbcadultmale.json'
     },
     {
          name: 'Full Blood Count Adult Female',
          filepath: './creationrules/fbcadultmale.json'
     },
     {
          name: 'Syphilis Screening',
          filepath: './creationrules/syphilis.json'
     },
     {
          name: 'Urine Routine Examination',
          filepath: './creationrules/urineroutine.json'
     },
     {
          name: 'Stool Routine Examination',
          filepath: './creationrules/stoolroutine.json'
     },
     {
          name: 'Semen Analysis',
          filepath: './creationrules/semenanalysis.json'
     },
     {
          name: 'Culture & Sensitivity - Pus',
          filepath: './creationrules/pus_culture.json'
     },
     {
          name: 'Culture Sensitivity-Stool',
          filepath: './creationrules/stool_culture.json'
     },
     {
          name: 'Pap Smear (Cervical & Vaginal Cytology)',
          filepath: './creationrules/pap_smear.json'
     },
     {
          name: 'Alberts Stain Report',
          filepath: './creationrules/alberts_stain.json'
     },
     {
          name: 'QUADRUPLE MARKER TEST',
          filepath: './creationrules/quadruple_marker.json'
     },
     {
          name: 'Culture Sensitivity- Sputum',
          filepath: './creationrules/sputum_culture.json'
     },
     {
          name: 'Toxoplasma - IgG Antibody',
          filepath: './creationrules/toxoplasma.json'
     },
     {
          name: 'Toxoplasma - IgM Antibody',
          filepath: './creationrules/toxoplasma.json'
     },
     {
          name: 'TPHA (Treponema Pallidium Haemagglutination Assay)',
          filepath: './creationrules/tpha.json'
     },
     {
          name: 'Transferrin',
          filepath: './creationrules/transferrin.json'
     },
     {
          name: 'Triglyceride',
          filepath: './creationrules/triglyceride.json'
     },
     {
          name: 'TSH (Thyroid Stimulating Hormone)',
          filepath: './creationrules/tsh.json'
     },
     {
          name: 'Tuberculin Test (TT) (Montoux Test)',
          filepath: './creationrules/tuberculin.json'
     },
     {
          name: 'Urine For Ketone Bodies (Acetone)',
          filepath: './creationrules/urine_ketone.json'
     },
     {
          name: 'Urine For Microalbumin',
          filepath: './creationrules/urine_microalbumin.json'
     },
     {
          name: 'Urine For Occult Blood',
          filepath: './creationrules/urine_occult_blood.json'
     },
     {
          name: 'Urine Pregnancy Test',
          filepath: './creationrules/urine_pregnancy.json'
     },
     {
          name: 'Glucose Tolerance Test (GTT) Extended',
          filepath: './creationrules/gtt_extended.json'
     },
     {
          name: 'Beta Thalassemia Screening',
          filepath: './creationrules/beta_thalassemia.json'
     },
     {
          name: 'Hepatitis B Virus (HBV) Qualitative PCR',
          filepath: './creationrules/hbv_pcr.json'
     },
     {
          name: 'Anti Diuretic Hormone (ADH) / Vasopressin',
          filepath: './creationrules/adh.json'
     },
     {
          name: 'Gene Expert Plus MTB/RIF',
          filepath: './creationrules/genexpert_mtb.json'
     },
     {
          name: 'Leptospira Antibody IgG & IgM',
          filepath: './creationrules/leptospira_combined.json'
     },
     {
          name: 'Leptospira Antibody IgG',
          filepath: './creationrules/leptospira_igg.json'
     },
     {
          name: 'Serum Pregnancy Test',
          filepath: './creationrules/serum_pregnancy.json'
     },
     {
          name: 'Vitamin B6',
          filepath: './creationrules/vitamin_b6.json'
     },
     {
          name: 'VLDL Cholesterol',
          filepath: './creationrules/vldl.json'
     },
     {
          name: '24 Hrs. Urine Metanephrine',
          filepath: './creationrules/urine_metanephrine.json'
     },
     {
          name: 'Adrenal Ganglioneuroma',
          filepath: './creationrules/adrenal_ganglioneuroma.json'
     },
     {
          name: 'Adrenal Phaeochromocytoma',
          filepath: './creationrules/adrenal_pheochromocytoma.json'
     },
     {
          name: 'FSH (Follicle Stimulating Hormone)',
          filepath: './creationrules/fsh.json'
     },
     {
          name: 'LH (Luteinizing Hormone)',
          filepath: './creationrules/lh.json'
     },
     {
          name: 'Hormonal Profile',
          filepath: './creationrules/hormonal_profile.json'
     },
     {
          name: 'Glucose Fasting',
          filepath: './creationrules/glucose_fasting.json'
     },
     {
          name: 'Lipid Profile',
          filepath: './creationrules/lipid_profile.json'
     },
     {
          name: 'Kidney Function Test',
          filepath: './creationrules/kidney_function.json'
     },
     {
          name: 'Liver Function Test',
          filepath: './creationrules/liver_function.json'
     },
     {
          name: 'Random Blood Glucose',
          filepath: './creationrules/random_glucose.json'
     },
     {
          name: 'Testosterone Total',
          filepath: './creationrules/testosterone.json'
     },
     {
          name: 'Prolactin',
          filepath: './creationrules/prolactin.json'
     },
     {
          name: 'Progesterone',
          filepath: './creationrules/progesterone.json'
     },
     {
          name: 'Estradiol (E2)',
          filepath: './creationrules/estradiol.json'
     },
     {
          name: 'Anti-Mullerian Hormone',
          filepath: './creationrules/amh.json'
     },
     {
          name: 'Beta HCG',
          filepath: './creationrules/beta_hcg.json'
     },
     {
          name: 'G6PD',
          filepath: './creationrules/g6pd.json'
     },
     {
          name: 'Hepatitis B Surface Antigen (HBsAg)',
          filepath: './creationrules/hbsag.json'
     },
     {
          name: 'Hepatitis C Antibody (Anti-HCV)',
          filepath: './creationrules/hcv.json'
     },
     {
          name: 'HIV I & II',
          filepath: './creationrules/hiv.json'
     },
     {
          name: 'Chlamydia IgA & IgM',
          filepath: './creationrules/chlamydia.json'
     },
     {
          name: 'Gonorrhea Test',
          filepath: './creationrules/gonorrhea.json'
     },
     {
          name: 'Vitamin B12',
          filepath: './creationrules/vitamin_b12.json'
     },
     {
          name: 'Vitamin D (25-OH)',
          filepath: './creationrules/vitamin_d.json'
     },
     {
          name: 'C-Reactive Protein',
          filepath: './creationrules/crp.json'
     },
     {
          name: 'DHEA-Sulfate',
          filepath: './creationrules/dhea.json'
     },
     {
          name: 'Folate',
          filepath: './creationrules/folate.json'
     },
     {
          name: 'Magnesium',
          filepath: './creationrules/magnesium.json'
     },
     {
          name: 'ESR (Erythrocyte Sedimentation Rate)',
          filepath: './creationrules/esr.json'
     },
     {
          name: 'Coagulation Profile (PT/INR/APTT)',
          filepath: './creationrules/coagulation_profile.json'
     },
     {
          name: 'Reticulocyte Count',
          filepath: './creationrules/reticulocyte.json'
     },
     {
          name: 'Iron Studies',
          filepath: './creationrules/iron_studies.json'
     },
     {
          name: 'Calcium',
          filepath: './creationrules/calcium.json'
     },
     {
          name: 'Phosphorus',
          filepath: './creationrules/phosphorus.json'
     },
     {
          name: 'Uric Acid',
          filepath: './creationrules/uric_acid.json'
     },
     {
          name: 'Protein Profile',
          filepath: './creationrules/protein_profile.json'
     },
     {
          name: 'Pancreatic Enzymes',
          filepath: './creationrules/pancreatic_enzymes.json'
     },
     {
          name: 'HbA1c',
          filepath: './creationrules/hba1c.json'
     },
     {
          name: 'Electrolytes',
          filepath: './creationrules/electrolytes.json'
     },
     {
          name: 'Parathyroid Hormone (PTH)',
          filepath: './creationrules/pth.json'
     },
     {
          name: 'Tumor Markers Panel',
          filepath: './creationrules/tumor_markers.json'
     },
     {
          name: 'Autoimmune Markers',
          filepath: './creationrules/autoimmune_markers.json'
     },
     {
          name: 'ASO Titer',
          filepath: './creationrules/aso.json'
     },
     {
          name: 'Dengue Serology',
          filepath: './creationrules/dengue_serology.json'
     },
     {
          name: 'Rubella Serology',
          filepath: './creationrules/rubella_serology.json'
     }
]