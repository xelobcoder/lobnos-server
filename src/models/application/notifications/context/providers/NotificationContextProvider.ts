import { EventDefinition } from './NotificationEventDefinitions';

export interface NotificationContextProvider {
     getContext(referenceId?: number | string): Promise<Record<string, unknown>>;
     supportsEvent?(eventCode: string): boolean;
     getEventDefinition?(eventCode: string): EventDefinition | null;
}

export type ContextResolver = (referenceId?: number | string) => Promise<Record<string, unknown>>;
