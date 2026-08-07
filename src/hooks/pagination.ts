export type PaginationInput = {
     page?: string | string[];
     count?: string | string[];
};

export type PaginationOptions = {
     defaultPage?: number;
     defaultCount?: number;
     maxCount?: number;
};

export type PaginationResult = {
     page?: number;
     count?: number;
     offset: number;
};

function firstValue(value: string | string[] | undefined): string | undefined {
     if (Array.isArray(value)) return value[0];
     return value;
}

export function parsePagination(query: PaginationInput, options: PaginationOptions = {}): PaginationResult {
     const defaultPage = options.defaultPage ?? 1;
     const defaultCount = options.defaultCount ?? 20;
     const maxCount = options.maxCount ?? 100;

     const pageValue = firstValue(query.page);
     const countValue = firstValue(query.count);
     const hasPage = pageValue !== undefined && pageValue !== '';
     const hasCount = countValue !== undefined && countValue !== '';

     if (!hasPage && !hasCount) {
          return {
               page: undefined,
               count: undefined,
               offset: 0,
          };
     }

     const rawPage = Number.parseInt(pageValue || '', 10);
     const rawCount = Number.parseInt(countValue || '', 10);

     const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : defaultPage;
     const count = Math.min(
          Number.isFinite(rawCount) && rawCount > 0 ? rawCount : defaultCount,
          maxCount,
     );

     return {
          page,
          count,
          offset: (page - 1) * count,
     };
}