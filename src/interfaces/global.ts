export type ConvertKeysToNumbers<T> = {
    [K in keyof T]: number
}