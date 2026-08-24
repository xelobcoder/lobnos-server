export interface Paging {
     page: number;
     count: number;
     offset: number;
}

export interface Sort {
     column: string;
     direction: 'asc' | 'desc';
}

const MAX_COUNT = 500;

/** PrimeTable sends `page` and `count`; both are clamped so a caller cannot ask for the whole table. */
export function parsePaging(query: any, defaultCount = 25): Paging {
     const page = Math.max(1, Number(query?.page) || 1);
     const count = Math.min(MAX_COUNT, Math.max(1, Number(query?.count) || defaultCount));
     return { page, count, offset: (page - 1) * count };
}

/**
 * PrimeTable sends `sortby` as either `column` or `column:direction`. The column is checked against
 * a whitelist so the value can never reach SQL unvalidated.
 */
export function parseSort(query: any, allowed: string[], fallback: Sort): Sort {
     const raw = String(query?.sortby || '').trim();
     if (!raw) return fallback;

     const [columnPart, directionPart] = raw.split(':');
     const column = columnPart?.trim();
     if (!column || !allowed.includes(column)) return fallback;

     const direction = String(directionPart || '').toLowerCase() === 'asc' ? 'asc' : 'desc';
     return { column, direction };
}

/** Sorts and slices an in-memory result set for reports that cannot be paged in SQL. */
export function paginate<T>(rows: T[], paging: Paging, sort?: Sort): { data: T[]; total: number; page: number; count: number } {
     const sorted = sort ? [...rows].sort(compareBy(sort)) : rows;

     return {
          data: sorted.slice(paging.offset, paging.offset + paging.count),
          total: rows.length,
          page: paging.page,
          count: paging.count,
     };
}

function compareBy<T>(sort: Sort) {
     return (left: any, right: any) => {
          const a = left?.[sort.column];
          const b = right?.[sort.column];

          if (a == null && b == null) return 0;
          if (a == null) return 1;
          if (b == null) return -1;

          const comparison =
               typeof a === 'number' && typeof b === 'number'
                    ? a - b
                    : String(a).localeCompare(String(b), undefined, { numeric: true });

          return sort.direction === 'asc' ? comparison : -comparison;
     };
}
