
SELECT 
   ts.collection_date,
   ts.processing_date,
   ts.ready_date,
   pt.URGENCY AS urgency,
   pt.Phelobotomist,
   np.GENDER AS gender,
   CONCAT(np.FIRSTNAME," ",np.MIDDLENAME," ",np.LASTNAME) AS fullname,
   CONCAT(np.age," ",np.agetype) AS age,
   pt.INSPECTION_TIME AS inspectionTime,
   b.NAME as samplingCenter,
   c.NAME as clinician
FROM test_ascension AS ts
  INNER JOIN performing_test AS pt ON pt.BILLINGID = ts.billingid
  INNER JOIN branch AS b ON b.BRANCHID = pt.SAMPLING_CENTER
  INNER JOIN new_patients as np ON np.PATIENTID = pt.PATIENTID
  INNER JOIN billing as bb ON bb.BILLINGID = pt.BILLINGID
  INNER JOIN clinician as c ON bb.CLINICIAN = c.ID
WHERE ts.billingid = 134 and testid = 2


 SELECT 
rt.parameter,
st.UPPER as upper,
st.LOWER as lower,
rt.UNIT as unit,
rt.value,
c.comments
from setup_liver_function_test AS st INNER JOIN result_function_liver AS rt ON  rt.parameter = st.PARAMETER
INNER JOIN result_comments AS c ON c.billingid = rt.billingid
WHERE rt.billingid = 27