export const testCreationRule: string = "SELECT creationrule FROM customtestcreation WHERE testid = ?";

export const getGenderQuery: string = "SELECT gender,age,agetype FROM new_patients WHERE patientid = ?";

export const _comments_query: string = "SELECT comments FROM result_comments WHERE billingid = ? AND testid = ?";

export const update_creation_query: string = "UPDATE customtestcreation SET creationrule = ? WHERE testid = ?";
