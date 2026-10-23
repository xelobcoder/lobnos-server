import { describe, expect, it } from 'vitest';
import { relationshipHandover } from './relationshipHandover';
const lead = { referrer_id: 11, prospect_type: 'clinician' };
const assignment = { id: 4, is_active: 1, assigned_from: '2026-10-01', assigned_to: '2026-10-31' };
describe('post-agreement handover', () => {
 it('distinguishes an effective agreement from a first referral', () => {
  expect(relationshipHandover(lead, [assignment], null, '2026-10-23')).toMatchObject({ status: 'effective', has_referrals: false });
  expect(relationshipHandover(lead, [assignment], { serviceAddedOn: '2026-09-01' }, '2026-10-23')).toMatchObject({ status: 'effective', has_referrals: true, first_referral: '2026-09-01' });
 });
 it('does not present future agreements as effective', () => {
  expect(relationshipHandover(lead, [assignment], null, '2026-09-01').status).toBe('scheduled');
 });
 it('flags expired or disabled assignments for review', () => {
  expect(relationshipHandover(lead, [assignment], null, '2026-11-01').status).toBe('needs_review');
  expect(relationshipHandover(lead, [{ ...assignment, is_active: 0 }], null, '2026-10-23').status).toBe('needs_review');
 });
 it('keeps current terms visible when a replacement is scheduled', () => {
  expect(relationshipHandover(lead, [{ ...assignment, id: 5, assigned_from: '2026-11-01', assigned_to: null }, assignment], null, '2026-10-23').assignment?.id).toBe(4);
 });
});
