import { afterEach, beforeEach, describe, it } from 'vitest';
import { Nanium } from "../../../core";
import { LogLevel, NaniumLogger } from "../../../interfaces/logger";
import { NaniumConsumerBrowserHttp } from "../../../managers/consumers/browserHttp";
import { session } from "../../session";
import { TestLogger } from "../../testLogger";
import { TestCore } from "../test-core";

describe('HTTP: events & cluster communicator', function (): void {
	let manager1: NaniumConsumerBrowserHttp;
	let manager2: NaniumConsumerBrowserHttp;
	let manager3: NaniumConsumerBrowserHttp;

	beforeEach(async () => {
		session.token = '1234';
		session.tenant = 'Company1';
		manager1 = await TestCore.addHttpConsumer('http://localhost:8080');
		manager2 = await TestCore.addHttpConsumer('http://localhost:8081');
		manager3 = await TestCore.addHttpConsumer('http://localhost:8081'); // for two different client-IDs connected with the same server
		NaniumLogger.addLogger(new TestLogger(LogLevel.error));
	});

	afterEach(async () => {
		await Nanium.shutdown();
	});

	it('subscribe with wrong auth token', async function (): Promise<void> {
		await TestCore.subscribeWithWrongAuthToken(manager1);
	});

	it('event should also be received by clients that are connected to other server processes', async function (): Promise<void> {
		await TestCore.interProcessEventEmission(manager1, manager2, manager3);
	});

	it('unsubscribe without parameters', async function (): Promise<void> {
		await TestCore.unsubscribeWithoutParameters(manager1, true);
		// await TestCore.unsubscribeWithoutParameters(manager1, false);
	});

	it('event should not be received by users of other tenants than me, because of the TestEventEmissionSendInterceptor on server side', async function (): Promise<void> {
		await TestCore.eventEmissionInterceptor(manager1, manager2);
	});

	it('subscribe to event using the event name instead of the event constructor', async function (): Promise<void> {
		await TestCore.subscribeEventByName(manager1);
	});

	it('normal event subscription and emission should choose the Mock implementation', async function (): Promise<void> {
		await TestCore.responsibilityForEventsTest();
	});
});
