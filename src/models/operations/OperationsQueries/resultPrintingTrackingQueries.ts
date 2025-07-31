export const q_insert_result_printing_tracking = `
  INSERT INTO resultprintingtracking (ascensionid, employeeid, action, actionon)
  VALUES (?, ?, ?, ?)
`;

export const q_get_result_printing_tracking_by_id = `
  SELECT * FROM resultprintingtracking WHERE trackid = ?
`;

export const q_get_result_printing_tracking_by_ascensionid = `
  SELECT * FROM resultprintingtracking WHERE ascensionid = ?
`;

export const q_update_result_printing_tracking = `
  UPDATE resultprintingtracking SET ascensionid = ?, employeeid = ?, action = ?, actionon = ?
  WHERE trackid = ?
`;

export const q_delete_result_printing_tracking = `
  DELETE FROM resultprintingtracking WHERE trackid = ?
`;
