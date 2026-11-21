export function parseConfiguredTat(value: unknown, unit:unknown='min'): number | null {
     const multiplier=/^days?$/i.test(String(unit))?1440:/^(hours?|hrs?)$/i.test(String(unit))?60:/^seconds?$/i.test(String(unit))?1/60:1;
     if (typeof value === "number") return Number.isFinite(value) && value > 0 ? Math.ceil(value*multiplier) : null;
     const text = String(value ?? "").trim();
     if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text) > 0 ? Math.ceil(Number(text)*multiplier) : null;
     const parts = [...text.matchAll(/(\d+)\s*(days?|hours?|hrs?|minutes?|mins?)/gi)];
     const minutes = parts.reduce(
          (sum, part) => sum + Number(part[1]) * (/^d/i.test(part[2]) ? 1440 : /^h/i.test(part[2]) ? 60 : 1),
          0,
     );
     return minutes > 0 ? minutes : null;
}

// Uses explicit minute settings; urgent/stat fall back to the configured routine target, never an invented clinical target.
export const LAB_EFFECTIVE_DUE_SQL = `COALESCE(work.due_at, TIMESTAMPADD(MINUTE,
     CASE COALESCE(work.priority, 'routine') WHEN 'stat' THEN COALESCE(panel.lab_stat_tat_minutes, panel.lab_routine_tat_minutes)
     WHEN 'urgent' THEN COALESCE(panel.lab_urgent_tat_minutes, panel.lab_routine_tat_minutes)
     ELSE panel.lab_routine_tat_minutes END, ta.ascension_date))`;

/** Processing start to processing end is analytical time; waiting and collection are separate. */
export function analyticTatMetrics(row:any){
 const expected=parseConfiguredTat(row.tat??row.setTat,row.tatEvaluation??'min');
 const start=row.processingStartDate?new Date(row.processingStartDate).getTime():NaN;
 const end=row.processingEndDate?new Date(row.processingEndDate).getTime():NaN;
 const actual=Number.isFinite(start)&&Number.isFinite(end)&&end>start?Math.round((end-start)/60000):null;
 return {analyticTatMinutes:expected,actualAnalyticTatMinutes:actual,analyticTatExceeded:expected!==null&&actual!==null?actual>expected:null,analyticTatExceededBy:expected!==null&&actual!==null?Math.max(0,actual-expected):null};
}
