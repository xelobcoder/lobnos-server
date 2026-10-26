export function parseConfiguredTat(value: unknown): number | null {
	if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
	const text = String(value ?? '').trim();
	if (/^\d+$/.test(text)) return Number(text) > 0 ? Number(text) : null;
	const parts = [...text.matchAll(/(\d+)\s*(days?|hours?|hrs?|minutes?|mins?)/gi)];
	const minutes = parts.reduce((sum, part) => sum + Number(part[1]) * (/^d/i.test(part[2]) ? 1440 : /^h/i.test(part[2]) ? 60 : 1), 0);
	return minutes > 0 ? minutes : null;
}

// Uses explicit minute settings; urgent/stat fall back to the configured routine target, never an invented clinical target.
export const LAB_EFFECTIVE_DUE_SQL = `COALESCE(work.due_at, TIMESTAMPADD(MINUTE,
     CASE COALESCE(work.priority, 'routine') WHEN 'stat' THEN COALESCE(panel.lab_stat_tat_minutes, panel.lab_routine_tat_minutes)
     WHEN 'urgent' THEN COALESCE(panel.lab_urgent_tat_minutes, panel.lab_routine_tat_minutes)
     ELSE panel.lab_routine_tat_minutes END, ta.ascension_date))`;
