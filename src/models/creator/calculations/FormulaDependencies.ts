/** Outputs are evaluated only after every calculated dependency has been evaluated. */
export function orderFormulaDependencies<T extends { output_field_id: number; input_parameters: any }>(formulas: T[]): T[] {
     const byOutput = new Map(formulas.map(formula => [Number(formula.output_field_id), formula]));
     const visiting = new Set<number>(), visited = new Set<number>(), ordered: T[] = [];
     const visit = (id: number) => {
          if (visiting.has(id)) throw new Error('Calculated parameters contain a circular dependency.');
          if (visited.has(id)) return;
          visiting.add(id);
          const formula = byOutput.get(id)!;
          const inputs = typeof formula.input_parameters === 'string' ? JSON.parse(formula.input_parameters) : formula.input_parameters;
          for (const input of inputs) if (byOutput.has(Number(input.fieldId))) visit(Number(input.fieldId));
          visiting.delete(id); visited.add(id); ordered.push(formula);
     };
     for (const id of byOutput.keys()) visit(id);
     return ordered;
}
