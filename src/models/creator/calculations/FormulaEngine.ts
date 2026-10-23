type Token =
     | { type: 'number'; value: number }
     | { type: 'identifier'; value: string }
     | { type: 'operator'; value: string }
     | { type: 'punctuation'; value: string };

const FUNCTIONS: Record<string, (...values: number[]) => number> = {
     sqrt: (value) => Math.sqrt(value),
     log: (value) => Math.log(value),
     abs: (value) => Math.abs(value),
     min: (...values) => Math.min(...values),
     max: (...values) => Math.max(...values),
};

function tokenize(expression: string): Token[] {
     if (!expression.trim() || expression.length > 1000) {
          throw new Error('Formula must contain between 1 and 1000 characters.');
     }

     const tokens: Token[] = [];
     let offset = 0;
     while (offset < expression.length) {
          const remaining = expression.slice(offset);
          const whitespace = remaining.match(/^\s+/);
          if (whitespace) {
               offset += whitespace[0].length;
               continue;
          }

          const number = remaining.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
          if (number) {
               const value = Number(number[0]);
               if (!Number.isFinite(value)) throw new Error('Formula contains an invalid number.');
               tokens.push({ type: 'number', value });
               offset += number[0].length;
               continue;
          }

          const identifier = remaining.match(/^[A-Za-z_][A-Za-z0-9_]*/);
          if (identifier) {
               tokens.push({ type: 'identifier', value: identifier[0] });
               offset += identifier[0].length;
               continue;
          }

          const character = expression[offset];
          if ('+-*/^'.includes(character)) {
               tokens.push({ type: 'operator', value: character });
          } else if ('(),'.includes(character)) {
               tokens.push({ type: 'punctuation', value: character });
          } else {
               throw new Error(`Unsupported character in formula: ${character}`);
          }
          offset += 1;
          if (tokens.length > 256) throw new Error('Formula is too complex.');
     }

     return tokens;
}

class FormulaParser {
     private index = 0;

     constructor(private readonly tokens: Token[], private readonly variables: Record<string, number>, private readonly syntaxOnly = false) { }

     parse(): number {
          const value = this.parseExpression(0);
          if (this.index !== this.tokens.length) throw new Error('Unexpected token in formula.');
          return this.assertFinite(value);
     }

     private parseExpression(depth: number): number {
          this.assertDepth(depth);
          let value = this.parseTerm(depth + 1);
          while (this.matchOperator('+') || this.matchOperator('-')) {
               const operator = this.consume().value;
               const right = this.parseTerm(depth + 1);
               value = operator === '+' ? value + right : value - right;
          }
          return this.assertFinite(value);
     }

     private parseTerm(depth: number): number {
          let value = this.parseUnary(depth + 1);
          while (this.matchOperator('*') || this.matchOperator('/')) {
               const operator = this.consume().value;
               const right = this.parseUnary(depth + 1);
               if (!this.syntaxOnly && operator === '/' && right === 0) throw new Error('Formula cannot divide by zero.');
               value = operator === '*' ? value * right : value / right;
          }
          return this.assertFinite(value);
     }

     private parsePower(depth: number): number {
          const value = this.parsePrimary(depth + 1);
          if (!this.matchOperator('^')) return value;
          this.consume();
          return this.assertFinite(Math.pow(value, this.parseUnary(depth + 1)));
     }

     private parseUnary(depth: number): number {
          if (this.matchOperator('+') || this.matchOperator('-')) {
               const operator = this.consume().value;
               const value = this.parseUnary(depth + 1);
               return operator === '-' ? -value : value;
          }
          return this.parsePower(depth + 1);
     }

     private parsePrimary(depth: number): number {
          this.assertDepth(depth);
          const token = this.consume();
          if (!token) throw new Error('Formula ended unexpectedly.');
          if (token.type === 'number') return token.value;

          if (token.type === 'punctuation' && token.value === '(') {
               const value = this.parseExpression(depth + 1);
               this.expectPunctuation(')');
               return value;
          }

          if (token.type !== 'identifier') throw new Error('Expected a number, parameter, or function.');
          if (this.matchPunctuation('(')) return this.parseFunction(token.value, depth + 1);

          const value = this.variables[token.value];
          if (value === undefined || !Number.isFinite(value)) {
               throw new Error(`Formula input "${token.value}" is missing or invalid.`);
          }
          return value;
     }

     private parseFunction(name: string, depth: number): number {
          const fn = FUNCTIONS[name];
          if (!fn) throw new Error(`Formula function "${name}" is not supported.`);
          this.expectPunctuation('(');
          const args: number[] = [];
          if (!this.matchPunctuation(')')) {
               do {
                    args.push(this.parseExpression(depth + 1));
               } while (this.matchPunctuation(',') && this.consume());
          }
          this.expectPunctuation(')');

          if ((name === 'sqrt' || name === 'log' || name === 'abs') && args.length !== 1) {
               throw new Error(`Formula function "${name}" requires one argument.`);
          }
          if ((name === 'min' || name === 'max') && args.length === 0) {
               throw new Error(`Formula function "${name}" requires at least one argument.`);
          }
          if (!this.syntaxOnly && name === 'sqrt' && args[0] < 0) throw new Error('sqrt() requires a non-negative input.');
          if (!this.syntaxOnly && name === 'log' && args[0] <= 0) throw new Error('log() requires a positive input.');
          return this.assertFinite(fn(...args));
     }

     private assertDepth(depth: number): void {
          if (depth > 64) throw new Error('Formula nesting is too deep.');
     }

     private assertFinite(value: number): number {
          if (this.syntaxOnly) return 1;
          if (!Number.isFinite(value)) throw new Error('Formula result is not a finite number.');
          return value;
     }

     private matchOperator(value: string): boolean {
          const token = this.tokens[this.index];
          return token?.type === 'operator' && token.value === value;
     }

     private matchPunctuation(value: string): boolean {
          const token = this.tokens[this.index];
          return token?.type === 'punctuation' && token.value === value;
     }

     private expectPunctuation(value: string): void {
          if (!this.matchPunctuation(value)) throw new Error(`Expected "${value}" in formula.`);
          this.consume();
     }

     private consume(): Token | undefined {
          return this.tokens[this.index++];
     }
}

export function evaluateFormula(expression: string, variables: Record<string, number>): number {
     return new FormulaParser(tokenize(expression), variables).parse();
}

/** Validate grammar and identifiers without assuming any particular patient input values. */
export function validateFormula(expression: string, tokens: string[]): void {
     new FormulaParser(tokenize(expression), Object.fromEntries(tokens.map(token => [token, 1])), true).parse();
}
