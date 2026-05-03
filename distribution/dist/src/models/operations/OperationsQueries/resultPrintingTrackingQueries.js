"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.q_delete_result_printing_tracking = exports.q_update_result_printing_tracking = exports.q_get_result_printing_tracking_by_ascensionid = exports.q_get_result_printing_tracking_by_id = exports.q_insert_result_printing_tracking = void 0;
exports.q_insert_result_printing_tracking = `
  INSERT INTO resultprintingtracking (ascensionid, employeeid, action, actionon)
  VALUES (?, ?, ?, ?)
`;
exports.q_get_result_printing_tracking_by_id = `
  SELECT * FROM resultprintingtracking WHERE trackid = ?
`;
exports.q_get_result_printing_tracking_by_ascensionid = `
  SELECT * FROM resultprintingtracking WHERE ascensionid = ?
`;
exports.q_update_result_printing_tracking = `
  UPDATE resultprintingtracking SET ascensionid = ?, employeeid = ?, action = ?, actionon = ?
  WHERE trackid = ?
`;
exports.q_delete_result_printing_tracking = `
  DELETE FROM resultprintingtracking WHERE trackid = ?
`;
