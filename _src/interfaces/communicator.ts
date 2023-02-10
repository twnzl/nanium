import { ExecutionContext } from './executionContext';

export interface NaniumCommunicator {
	broadcastEvent(event: any, eventName: string, context?: ExecutionContext): Promise<void>;
}
