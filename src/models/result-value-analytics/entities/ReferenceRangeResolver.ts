import { TestCreationRule } from '../../TestCreation/TestCreationRulesRepository';
import { applyDemographicLimits, AgeGroup } from '../../creator/demographic-limits';
import { ResolvedRange } from '../interfaces';

export class ReferenceRangeResolver {
	static resolve(
		rule: TestCreationRule | null | undefined,
		patientGender: string | null | undefined,
		patientAge: number | null | undefined,
		patientAgeType: string | null | undefined,
	): ResolvedRange | null {
		if (!rule || rule.plan !== 'limits') {
			return null;
		}

		try {
			let ageGroup: AgeGroup = 'adult';
			if (patientAge !== null && patientAge !== undefined) {
				ageGroup = this.getDemographicAgeGroup(patientAge, patientAgeType);
			}

			const appliedLimits = applyDemographicLimits(
				rule,
				patientGender || '',
				ageGroup,
			);

			if (!appliedLimits) {
				return null;
			}

			const lowerLimit = appliedLimits.lowerlimit !== null && appliedLimits.lowerlimit !== undefined
				? Number(appliedLimits.lowerlimit)
				: null;
			const upperLimit = appliedLimits.upperlimit !== null && appliedLimits.upperlimit !== undefined
				? Number(appliedLimits.upperlimit)
				: null;

			if (lowerLimit !== null && !Number.isFinite(lowerLimit)) {
				return null;
			}
			if (upperLimit !== null && !Number.isFinite(upperLimit)) {
				return null;
			}

			const fingerprint = [
				rule.id,
				lowerLimit,
				upperLimit,
				rule.units || 'unitless',
			].join('|');

			return {
				lowerLimit,
				upperLimit,
				unit: rule.units || null,
				rangeVersion: fingerprint,
			};
		} catch {
			return null;
		}
	}

	private static getDemographicAgeGroup(age: number, ageType?: string | null): AgeGroup {
		const normalizedType = (ageType || 'years').toLowerCase().trim();

		if ((normalizedType === 'day' || normalizedType === 'days') && age <= 28) {
			return 'neonate';
		}

		if (
			normalizedType === 'day' || normalizedType === 'days' ||
			normalizedType === 'month' || normalizedType === 'months' ||
			((normalizedType === 'year' || normalizedType === 'years') && age < 18)
		) {
			return 'child';
		}

		return 'adult';
	}
}
