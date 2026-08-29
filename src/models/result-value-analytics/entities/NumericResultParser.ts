export class NumericResultParser {
	static parse(value: unknown): number | null {
		if (value === null || value === undefined || value === '') {
			return null;
		}

		const str = String(value).trim();
		if (str.length === 0) {
			return null;
		}

		if (/^[<>=!]/.test(str)) {
			return null;
		}

		if (/^(nil|none|n\/a|not detected|negative|positive|pending|normal|abnormal)$/i.test(str)) {
			return null;
		}

		// Only parse strict standard decimal/integer numbers to prevent encrypted/hex/hash strings like '5e76...' from being parsed as scientific exponents
		if (!/^[+-]?\d+(?:\.\d+)?$/.test(str)) {
			return null;
		}

		const num = parseFloat(str);
		if (!Number.isFinite(num) || Number.isNaN(num)) {
			return null;
		}

		// Reject extreme values exceeding laboratory limits or DB decimal capacity
		if (Math.abs(num) > 999999999999) {
			return null;
		}

		return num;
	}

	static bucketize(value: number, lowerLimit: number | null, upperLimit: number | null): string {
		if (lowerLimit === null || upperLimit === null) {
			return 'no_reference_range';
		}

		const lower = Number(lowerLimit);
		const upper = Number(upperLimit);

		if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
			return 'no_reference_range';
		}

		if (lower === upper) {
			if (value < lower) return 'below_range';
			if (value === lower) return 'at_reference_value';
			return 'above_range';
		}

		if (lower >= upper) {
			return 'no_reference_range';
		}

		if (value < lower) {
			return 'below_range';
		}

		if (value > upper) {
			return 'above_range';
		}

		const normalized = (value - lower) / (upper - lower);
		const binIndex = Math.min(3, Math.floor(normalized * 4));
		const binLabels = ['range_0_25', 'range_25_50', 'range_50_75', 'range_75_100'];
		return binLabels[binIndex];
	}
}
