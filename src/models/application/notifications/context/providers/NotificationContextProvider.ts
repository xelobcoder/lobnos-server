export interface NotificationContextProvider {
     getContext(referenceId?: number | string): Promise<Record<string, unknown>>;
}

export type ContextResolver = (referenceId?: number | string) => Promise<Record<string, unknown>>;
