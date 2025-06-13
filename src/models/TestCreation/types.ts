interface FieldConstraint {
     id?: number;
     testid: number;
     fieldid: number;
     action: 'alert' | 'do_not_alert' | 'replace' | "none" | "lock-result" | "prefix" | "suffix" | "prefix-suffix"
     constraint_type: 'less' | 'greater' | 'equals' | 'between' | 'contains' | 'notmatch' | "match"
     replacement_text?: string;
     value?: string;
     prefix?: string;
     suffix?: string;
}
