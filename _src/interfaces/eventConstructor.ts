import { ConstructorType } from '../objects';

export type EventConstructor<T = any> = ConstructorType<T> & { eventName: string };
export type EventNameOrConstructor<T = any> = EventConstructor<T> | string;
