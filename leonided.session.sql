SELECT rt.parameter,
  st.UPPER as upper,
  st.LOWER as lower,
  st.UNIT as unit,
  rt.value,
  c.comments
FROM setup_full_count_count_female AS st
  INNER JOIN result_function_full_blood_count AS rt ON rt.parameter = st.PARAMETER
  INNER JOIN result_comments AS c ON c.billingid = rt.billingid
WHERE rt.billingid = 153