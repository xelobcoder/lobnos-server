import { describe, expect, it } from 'vitest';
import { evaluateFormula } from './FormulaEngine';

describe('evaluateFormula', () => {
     it('applies arithmetic precedence and parentheses', () => {
          expect(evaluateFormula('(A * B) / D', { A: 10, B: 5, D: 2 })).toBe(25);
     });

     it('supports the approved mathematical functions', () => {
          expect(evaluateFormula('max(abs(A), sqrt(B)) + log(C)', { A: -4, B: 9, C: Math.E })).toBe(5);
     });

     it('rejects missing inputs, unsafe syntax, and invalid operations', () => {
          expect(() => evaluateFormula('A + B', { A: 1 })).toThrow('missing or invalid');
          expect(() => evaluateFormula('exec()', {})).toThrow('not supported');
          expect(() => evaluateFormula('A / 0', { A: 1 })).toThrow('divide by zero');
          expect(() => evaluateFormula('sqrt(-1)', {})).toThrow('non-negative');
     });
});