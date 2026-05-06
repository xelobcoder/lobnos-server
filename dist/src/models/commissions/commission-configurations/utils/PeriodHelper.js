"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodHelper = void 0;
class PeriodHelper {
    /**
     * Calculate the reference date (first day of period) based on reset frequency
     */
    static getPeriodReferenceDate(date, resetType) {
        const d = new Date(date);
        switch (resetType) {
            case 'daily':
                return new Date(d.getFullYear(), d.getMonth(), d.getDate());
            case 'weekly':
                // Monday of the week
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                return new Date(d.getFullYear(), d.getMonth(), diff);
            case 'monthly':
                return new Date(d.getFullYear(), d.getMonth(), 1);
            case 'quarterly':
                const quarter = Math.floor(d.getMonth() / 3);
                return new Date(d.getFullYear(), quarter * 3, 1);
            case 'yearly':
                return new Date(d.getFullYear(), 0, 1);
            default:
                throw new Error(`Unknown period reset type: ${resetType}`);
        }
    }
    /**
     * Get the end date of a period
     */
    static getPeriodEndDate(date, resetType) {
        const d = new Date(date);
        switch (resetType) {
            case 'daily':
                const daily = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
                return new Date(daily.getTime() - 1);
            case 'weekly':
                const startOfWeek = this.getPeriodReferenceDate(d, 'weekly');
                const endOfWeek = new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000);
                return endOfWeek;
            case 'monthly':
                const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
                return new Date(nextMonth.getTime() - 1);
            case 'quarterly':
                const startOfQuarter = this.getPeriodReferenceDate(d, 'quarterly');
                const nextQuarter = new Date(startOfQuarter.getFullYear(), startOfQuarter.getMonth() + 3, 1);
                return new Date(nextQuarter.getTime() - 1);
            case 'yearly':
                return new Date(d.getFullYear(), 11, 31, 23, 59, 59);
            default:
                throw new Error(`Unknown period reset type: ${resetType}`);
        }
    }
    /**
     * Check if date is in the same period
     */
    static isSamePeriod(date1, date2, resetType) {
        const ref1 = this.getPeriodReferenceDate(date1, resetType);
        const ref2 = this.getPeriodReferenceDate(date2, resetType);
        return ref1.getTime() === ref2.getTime();
    }
    /**
     * Get period name for logging/display
     */
    static getPeriodName(date, resetType) {
        const d = new Date(date);
        switch (resetType) {
            case 'daily':
                return d.toISOString().split('T')[0];
            case 'weekly':
                const startOfWeek = this.getPeriodReferenceDate(d, 'weekly');
                const endOfWeek = this.getPeriodEndDate(d, 'weekly');
                return `Week of ${startOfWeek.toISOString().split('T')[0]}`;
            case 'monthly':
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            case 'quarterly':
                const quarter = Math.floor(d.getMonth() / 3) + 1;
                return `Q${quarter} ${d.getFullYear()}`;
            case 'yearly':
                return `${d.getFullYear()}`;
            default:
                return 'Unknown';
        }
    }
}
exports.PeriodHelper = PeriodHelper;
