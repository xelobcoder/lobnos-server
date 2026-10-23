const dateOnly = (value: any) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
export function relationshipHandover(lead: any, assignments: any[], firstReferral: any, onDate = new Date().toISOString().slice(0, 10)) {
 const eligible = assignments.filter(row => Boolean(Number(row.is_active)));
 const current = eligible.find(row => dateOnly(row.assigned_from) <= onDate && (!row.assigned_to || dateOnly(row.assigned_to) >= onDate));
 const upcoming = eligible.filter(row => dateOnly(row.assigned_from) > onDate).sort((a,b) => dateOnly(a.assigned_from).localeCompare(dateOnly(b.assigned_from)))[0];
 const assignment = current || upcoming || null;
 const status = !lead.referrer_id ? 'not_linked' : current ? 'effective' : upcoming ? 'scheduled' : eligible.length && eligible.every(row => row.assigned_to && dateOnly(row.assigned_to) < onDate) ? 'expired' : 'needs_review';
 return { status, assignment, first_referral: firstReferral?.serviceAddedOn || null, has_referrals: Boolean(firstReferral), referrer_id: lead.referrer_id || null, referrer_type: lead.prospect_type };
}
