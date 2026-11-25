export type AnalyticsDateRange = {
	startDate: string;
	endDate: string;
};

const isValidDateOnly = (value: unknown): value is string => {
	if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}

	const parsed = new Date(`${value}T00:00:00.000Z`);
	return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const parseAnalyticsDateRange = (
	startDate: unknown,
	endDate: unknown
): AnalyticsDateRange | null => {
	if (!isValidDateOnly(startDate) || !isValidDateOnly(endDate) || startDate > endDate) {
		return null;
	}

	return { startDate, endDate };
};
