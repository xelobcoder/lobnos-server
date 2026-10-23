import { describe, expect, it } from 'vitest';
import { evaluateFormula, validateFormula } from './FormulaEngine';

describe('evaluateFormula', () => {
     it('applies conventional unary minus, right-associative powers and negative exponents', () => {
          expect(evaluateFormula('-2^2', {})).toBe(-4);
          expect(evaluateFormula('(-2)^2', {})).toBe(4);
          expect(evaluateFormula('2^-2', {})).toBe(0.25);
          expect(evaluateFormula('2^3^2', {})).toBe(512);
     });
     it('validates grammar without inventing sample input values', () => {
          expect(() => validateFormula('A/(B-C)', ['A', 'B', 'C'])).not.toThrow();
          expect(evaluateFormula('A/(B-C)', { A: 10, B: 5, C: 3 })).toBe(5);
          expect(() => validateFormula('A/(D-C)', ['A', 'B', 'C'])).toThrow('missing');
          expect(() => validateFormula('sqrt(A,B)', ['A', 'B'])).toThrow('one argument');
     });
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
