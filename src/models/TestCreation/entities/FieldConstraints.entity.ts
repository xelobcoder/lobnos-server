export enum ConstraintAction {
     NONE = "none",
     ALERT = "alert",
     IGNORE = "ignore",
     REPLACE = "replace",
     LOCK_RESULT = "lock-result",
}

export enum ConstraintType {
     NULL = "null",
     LESS = "less",
     GREATER = "greater",
     MATCH = "match",
     NOT_MATCH = "notmatch",
     BETWEEN = "between",
     CONTAINS = "contains",
}


export interface FieldConstraintEntity {
     id: number;
     testid: number;
     fieldid: number;
     action: ConstraintAction;
     constraint_type: ConstraintType;
     replacement_text: string | null;
     value: string | null;
     prefix: string | null;
     suffix: string | null;
}