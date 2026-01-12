import { afterEach, beforeEach, describe, it } from 'vitest';
import { Nanium } from "../../../core";
import { LogLevel, NaniumLogger } from "../../../interfaces/logger";
import { NaniumConsumerBrowserWebsocket } from "../../../managers/consumers/browserWs";
import { session } from "../../session";
import { TestLogger } from "../../testLogger";
import { TestCore } from "../test-core";

describe('Websockets: events & cluster communicator', function (): void {
	let manager1: NaniumConsumerBrowserWebsocket;
	let manager2: NaniumConsumerBrowserWebsocket;
	let manager3: NaniumConsumerBrowserWebsocket;

	beforeEach(async () => {
		NaniumLogger.addLogger(new TestLogger(LogLevel.warn));
		session.token = '1234';
		session.tenant = 'Company1';
		await TestCore.addHttpConsumer('http://localhost:8080', 2, 0);
		await TestCore.addHttpConsumer('http://localhost:8081', 3, 0);
		manager1 = await TestCore.addWebsocketConsumer('ws://localhost:8080', 0, 1);
		manager2 = await TestCore.addWebsocketConsumer('ws://localhost:8081', 0, 2);
		manager3 = await TestCore.addWebsocketConsumer('ws://localhost:8081', 0, 3); // for two different client-IDs connected with the same server
	});

	afterEach(async () => {
		await Nanium.shutdown();
		session.token = '1234';
		session.tenant = 'Company1';
	});

	it('subscribe with wrong auth token', async function (): Promise<void> {
		await TestCore.subscribeWithWrongAuthToken(manager1);
	});

	it('event should also be received by clients that are connected to other server processes', async function (): Promise<void> {
		await TestCore.interProcessEventEmission(manager1, manager2, manager3);
	});

	it('event should not be received by users of other tenants than me, because of the TestEventEmissionSendInterceptor on server side', async function (): Promise<void> {
		await TestCore.eventEmissionInterceptor(manager1, manager2);
	});

	it('subscribe to event using the event name instead of the event constructor', async function (): Promise<void> {
		await TestCore.subscribeEventByName(manager1);
	});

	it('unsubscribe without parameters', async function (): Promise<void> {
		await TestCore.unsubscribeWithoutParameters(manager1);
	});

	it('normal event subscription and emission should choose the Mock implementation', async function (): Promise<void> {
		await TestCore.responsibilityForEventsTest();
	});
});
