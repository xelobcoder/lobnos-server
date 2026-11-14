import { describe, expect, it } from 'vitest';
import { evaluateNewValue, evaluateSeries, thresholdsFor } from './QCStatistics';

const standard = { warningZ: 2, actionZ: 3 };

describe('server-side QC statistics', () => {
     it('marks an in-control series normal', () => {
          const result = evaluateSeries([100, 101, 99, 102, 98], 100, 5, standard);
          expect(result.every((entry) => entry.status === 'normal')).toBe(true);
          expect(result.at(-1)?.violations).toEqual([]);
     });

     it('warns at 1-2s and rejects at 1-3s', () => {
          expect(evaluateSeries([110], 100, 5, standard)[0]).toMatchObject({ status: 'warning', violations: ['1-2s'] });
          expect(evaluateSeries([116], 100, 5, standard)[0]).toMatchObject({ status: 'critical', violations: ['1-3s'] });
     });

     it('rejects two consecutive readings beyond 2SD on the same side', () => {
          const result = evaluateSeries([110, 111], 100, 5, standard);
          expect(result[1].status).toBe('critical');
          expect(result[1].violations).toContain('2-2s');
     });

     it('rejects an R-4s range across the mean', () => {
          const result = evaluateSeries([110, 88], 100, 5, standard);
          expect(result[1].status).toBe('critical');
          expect(result[1].violations).toContain('R-4s');
     });

     it('rejects four consecutive readings beyond 1SD on the same side', () => {
          const result = evaluateSeries([106, 107, 108, 109], 100, 5, standard);
          expect(result[3].status).toBe('critical');
          expect(result[3].violations).toContain('4-1s');
     });

     it('rejects ten consecutive readings on the same side of the mean', () => {
          const values = [101, 102, 101, 102, 101, 102, 101, 102, 101, 102];
          const result = evaluateSeries(values, 100, 5, standard);
          expect(result[9].status).toBe('critical');
          expect(result[9].violations).toContain('10-x');
     });

     it('marks a parameter without a standard deviation as unmonitored', () => {
          expect(evaluateSeries([50], 100, 0, standard)[0]).toMatchObject({ status: 'unmonitored', zScore: null });
     });

     it('derives warning and action thresholds from configured limits', () => {
          const thresholds = thresholdsFor(100, 10, 115, 130);
          expect(thresholds.warningZ).toBeCloseTo(1.5);
          expect(thresholds.actionZ).toBeCloseTo(3);
          const result = evaluateSeries([116], 100, 10, thresholds);
          expect(result[0].status).toBe('warning');
     });

     it('evaluates a new value against prior values and returns only the new result', () => {
          const evaluation = evaluateNewValue([110], 111, 100, 5, standard);
          expect(evaluation.status).toBe('critical');
          expect(evaluation.violations).toContain('2-2s');
     });
});
