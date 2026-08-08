export type ConditionRule = {
	id: number;
	testId: number;
	parameter: string;
	conditionId: number;
	target: string;
	inRange: number | boolean;
	conditionConstraint: string;
	conditionName?: string;
};

export type LoggingConstraintType =
	| 'null'
	| 'less'
	| 'greater'
	| 'match'
	| 'notmatch'
	| 'between'
	| 'contains';

const normalizeText = (value: unknown): string =>
	(value ?? '')
		.toString()
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ');

/** Normalize parameter/field names for matching. */
export const normalizeParameterName = (value: unknown): string => normalizeText(value);

/**
 * Map free-text operators from testconditions.conditionConstraint
 * onto loggingcriticalvaluealert.constraint_type values.
 */
export const normalizeConstraintType = (constraint: unknown): LoggingConstraintType | '' => {
	// "greater than value" → "greaterthanvalue"; the optional "(value)?" suffix
	// covers the real strings stored from the UI ("Less than value", etc.)
	const normalized = normalizeText(constraint).replace(/[^a-z0-9]+/g, '');
	if (!normalized) return '';

	const withoutValueSuffix = normalized.replace(/(value|number|thevalue)$/, '');
	const candidates = [normalized, withoutValueSuffix];

	const matches = (variants: string[]) =>
		candidates.some((candidate) => variants.includes(candidate));

	if (matches(['greaterthan', 'greater', 'gt', 'biggerthan', 'above', 'morethan'])) {
		return 'greater';
	}
	if (matches(['lessthan', 'less', 'lt', 'below', 'smallerthan'])) {
		return 'less';
	}
	if (matches(['equal', 'equals', 'equalto', 'match', 'matches', 'same', 'eq'])) {
		return 'match';
	}
	if (matches(['notequal', 'notequalto', 'notmatch', 'notmatches', 'doesnotequal', 'neq'])) {
		return 'notmatch';
	}
	if (matches(['contains', 'contain', 'includes', 'include', 'like'])) {
		return 'contains';
	}
	if (matches(['between', 'inrange', 'range', 'within'])) {
		return 'between';
	}

	return '';
};

const toNumber = (value: unknown): number | null => {
	if (value === undefined || value === null || value === '') return null;
	const parsed = Number(String(value).replace(/,/g, '').trim());
	return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Parse targets like "70-100", "70 – 100", "70 to 100".
 * Avoids treating the separator hyphen as a negative sign on the max value.
 */
export const parseBetweenRange = (target: string): { min: number; max: number } | null => {
	if (!target) return null;

	const cleaned = target.toString().trim();
	const match = cleaned.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|—|to)\s*(-?\d+(?:\.\d+)?)/i);
	if (!match) return null;

	const min = Number(match[1]);
	const max = Number(match[2]);
	if (!Number.isFinite(min) || !Number.isFinite(max)) return null;

	return min <= max ? { min, max } : { min: max, max: min };
};

/**
 * Evaluate one row from testconditions against a submitted result value.
 * Returns true when the rule is violated / critical alert should fire.
 *
 * inRange semantics (for between only):
 * - inRange = 1 → alert when value is INSIDE [min, max]
 * - inRange = 0 → alert when value is OUTSIDE [min, max]
 */
export const evaluateConditionRuleAgainstValue = (rule: ConditionRule, value: unknown): boolean => {
	if (!rule) return false;
	if (value === undefined || value === null || value === '') return false;

	const constraint = normalizeConstraintType(rule.conditionConstraint);
	if (!constraint) return false;

	const target = (rule.target ?? '').toString().trim();
	const inRange = Number(rule.inRange) === 1;

	if (constraint === 'between') {
		const range = parseBetweenRange(target);
		if (!range) return false;
		const numericValue = toNumber(value);
		if (numericValue === null) return false;

		const inside = numericValue >= range.min && numericValue <= range.max;
		return inRange ? inside : !inside;
	}

	if (constraint === 'greater') {
		const numericValue = toNumber(value);
		const numericTarget = toNumber(target);
		if (numericValue === null || numericTarget === null) return false;
		return numericValue > numericTarget;
	}

	if (constraint === 'less') {
		const numericValue = toNumber(value);
		const numericTarget = toNumber(target);
		if (numericValue === null || numericTarget === null) return false;
		return numericValue < numericTarget;
	}

	if (constraint === 'match') {
		return normalizeText(value) === normalizeText(target);
	}

	if (constraint === 'notmatch') {
		return normalizeText(value) !== normalizeText(target);
	}

	if (constraint === 'contains') {
		return normalizeText(value).includes(normalizeText(target));
	}

	return false;
};

export const buildCriticalAlertStatement = (
	field: string,
	value: unknown,
	rule: ConditionRule,
): string => {
	const constraint = normalizeConstraintType(rule.conditionConstraint) || rule.conditionConstraint;
	const conditionLabel = rule.conditionName || `condition #${rule.conditionId}`;
	return `Critical Value Occurred. Parameter "${field}" with value "${value}" violates ${conditionLabel} (${constraint}) target ${rule.target}.`;
};
