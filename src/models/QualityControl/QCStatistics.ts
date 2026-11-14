/**
 * Server-side QC statistics. The browser may display these rules, but only this module decides
 * the stored status of a reading. A client-supplied status is ignored by the controller.
 */
export type QcStatus = 'normal' | 'warning' | 'critical' | 'unmonitored';

export interface QcThresholds {
     /** |z| at or above this is a warning (default 2). */
     warningZ: number;
     /** |z| at or above this is a rejection (default 3). */
     actionZ: number;
}

export interface QcEvaluation {
     zScore: number | null;
     status: QcStatus;
     violations: string[];
}

const round = (value: number, places = 4) => Math.round(value * 10 ** places) / 10 ** places;

export function thresholdsFor(target: number, sd: number, warningLimit?: number | null, actionLimit?: number | null): QcThresholds {
     const warning = Number(warningLimit);
     const action = Number(actionLimit);
     return {
          warningZ: Number.isFinite(warning) && sd > 0 ? Math.abs((warning - target) / sd) || 2 : 2,
          actionZ: Number.isFinite(action) && sd > 0 ? Math.abs((action - target) / sd) || 3 : 3,
     };
}

/** Evaluates a chronological series for one control parameter. Returns one result per value. */
export function evaluateSeries(values: number[], target: number, sd: number, thresholds: QcThresholds): QcEvaluation[] {
     const usable = Number.isFinite(target) && Number.isFinite(sd) && sd > 0;
     const zScores = usable ? values.map((value) => (value - target) / sd) : [];
     return values.map((_value, index) => {
          if (!usable) return { zScore: null, status: 'unmonitored' as QcStatus, violations: ['NO_STANDARD_DEVIATION'] };
          return evaluateAt(zScores.slice(0, index + 1), thresholds);
     });
}

function evaluateAt(zScores: number[], thresholds: QcThresholds): QcEvaluation {
     const z = zScores[zScores.length - 1];
     const violations: string[] = [];
     let status: QcStatus = 'normal';
     const add = (rule: string, severity: 'warning' | 'critical') => {
          if (!violations.includes(rule)) violations.push(rule);
          if (severity === 'critical') status = 'critical';
          else if (status !== 'critical') status = 'warning';
     };

     if (Math.abs(z) >= thresholds.actionZ) add('1-3s', 'critical');
     else if (Math.abs(z) >= thresholds.warningZ) add('1-2s', 'warning');

     if (zScores.length >= 2) {
          const [a, b] = zScores.slice(-2);
          if (Math.abs(a) >= 2 && Math.abs(b) >= 2 && Math.sign(a) === Math.sign(b) && a !== 0) add('2-2s', 'critical');
          if (Math.sign(a) !== Math.sign(b) && Math.abs(a) + Math.abs(b) >= 4) add('R-4s', 'critical');
     }

     if (zScores.length >= 4) {
          const lastFour = zScores.slice(-4);
          if (lastFour.every((value) => Math.abs(value) >= 1) &&
               lastFour.every((value) => Math.sign(value) === Math.sign(lastFour[0]) && value !== 0)) add('4-1s', 'critical');
     }

     if (zScores.length >= 10) {
          const lastTen = zScores.slice(-10);
          if (lastTen.every((value) => Math.sign(value) === Math.sign(lastTen[0]) && value !== 0)) add('10-x', 'critical');
     }

     return { zScore: round(z), status, violations };
}

/** Convenience for one new reading: prior values first, the new value last. */
export function evaluateNewValue(priorValues: number[], newValue: number, target: number, sd: number, thresholds: QcThresholds): QcEvaluation {
     const series = [...priorValues, newValue];
     return evaluateSeries(series, target, sd, thresholds)[series.length - 1];
}
