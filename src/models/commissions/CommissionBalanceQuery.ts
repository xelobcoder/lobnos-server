/** Shared balance expressions for queries using commission_tracking ct and batch allocation cbps. */
export const commissionBalanceColumns = (conn: any) => [
     conn.raw("CAST(COALESCE(SUM(CASE WHEN ct.status <> 'voided' THEN ct.final_commission ELSE 0 END), 0) AS DECIMAL(14,2)) AS earned"),
     conn.raw("CAST(COALESCE(SUM(CASE WHEN cbps.id IS NOT NULL THEN cbps.amount_allocated WHEN ct.status = 'paid' THEN ct.final_commission ELSE 0 END), 0) AS DECIMAL(14,2)) AS paid"),
     conn.raw("CAST(COALESCE(SUM(CASE WHEN cbps.id IS NOT NULL THEN cbps.waived_amount ELSE 0 END), 0) AS DECIMAL(14,2)) AS waived"),
     conn.raw("CAST(COALESCE(SUM(CASE WHEN ct.status = 'pending' THEN GREATEST(0, ct.final_commission - COALESCE(cbps.amount_allocated, 0) - COALESCE(cbps.waived_amount, 0)) ELSE 0 END), 0) AS DECIMAL(14,2)) AS pending"),
     conn.raw("CAST(COALESCE(SUM(CASE WHEN ct.status = 'approved' THEN GREATEST(0, ct.final_commission - COALESCE(cbps.amount_allocated, 0) - COALESCE(cbps.waived_amount, 0)) ELSE 0 END), 0) AS DECIMAL(14,2)) AS approved"),
     conn.raw("CAST(COALESCE(SUM(CASE WHEN ct.status NOT IN ('voided', 'adjusted', 'paid') THEN GREATEST(0, ct.final_commission - COALESCE(cbps.amount_allocated, 0) - COALESCE(cbps.waived_amount, 0)) ELSE 0 END), 0) AS DECIMAL(14,2)) AS outstanding"),
];
