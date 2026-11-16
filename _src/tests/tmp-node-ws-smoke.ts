import { Nanium } from '../core.js';
import { NaniumBuffer } from '../interfaces/naniumBuffer.js';
import { NaniumStream } from '../interfaces/naniumStream.js';
import { NaniumConsumerNodeWebsocket } from '../managers/consumers/nodeWs.js';
import { NaniumJsonSerializer } from '../serializers/json.js';
import { EventSubscription } from '../interfaces/eventSubscription.js';
import { TestClientRequestInterceptor } from './interceptors/client/test.request.interceptor.js';
import { TestClientResponseInterceptor } from './interceptors/client/test.response.interceptor.js';
import { TestEventSubscriptionSendInterceptor } from './interceptors/client/test.send-event-subscription.interceptor.js';
import { TestGetRequest, TestGetResponse } from './services/test/get.contract.js';
import { TestBufferRequest } from './services/test/buffer.contract.js';
import { TestStreamedQueryRequest } from './services/test/streamedQuery.contract.js';

process.on('unhandledRejection', (reason) => {
	console.error('UNHANDLED REJECTION:', reason);
});
process.on('uncaughtException', (err) => {
	console.error('UNCAUGHT EXCEPTION:', err);
});
import { TestDto } from './services/test/contractparts.js';
import { StuffEvent } from './events/test/stuffEvent.js';
import { session } from './session.js';

async function main(): Promise<void> {
	session.token = '1234';
	session.tenant = 'Company1';
	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';
	const consumer = new NaniumConsumerNodeWebsocket({
		connectUrl: 'ws://localhost:8080',
		serializer,
		requestInterceptors: [TestClientRequestInterceptor],
		responseInterceptors: [TestClientResponseInterceptor],
		eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
		isResponsible: () => Promise.resolve(1),
		isResponsibleForEvent: () => Promise.resolve(1),
		handleError: (err: any) => Promise.reject(err),
	});
	await Nanium.addManager(consumer);

	// 1) event subscription round trip (get.executor.ts emits a StuffEvent as a side effect of the request below)
	let received: StuffEvent | undefined;
	const subscription: EventSubscription = await Nanium.subscribe(StuffEvent, async (event: StuffEvent) => {
		received = event;
	});

	// 2) simple request/response round trip
	const response: TestGetResponse = await new TestGetRequest({ input1: 'hello from node ws consumer' }).execute();
	if (response?.body?.output1 !== 'hello from node ws consumer :-)') {
		throw new Error('unexpected response: ' + JSON.stringify(response));
	}
	console.log('OK: request/response round trip:', response.body.output1);

	await new Promise(resolve => setTimeout(resolve, 500));
	if (!received) {
		throw new Error('event was not received');
	}
	console.log('OK: event round trip received:', JSON.stringify(received));

	// 3) unsubscribe
	await Nanium.unsubscribe(subscription);
	console.log('OK: unsubscribe did not throw');

	// 4) NaniumBuffer round trip (binary upload + download)
	const bufferRequest = new TestBufferRequest({
		id: '1',
		buffer1: new NaniumBuffer().writeString('123'),
		buffer2: new NaniumBuffer().writeString('456'),
	});
	const bufferResponse = await bufferRequest.execute();
	if (bufferResponse.text1 !== '123*' || bufferResponse.text2 !== '456*') {
		throw new Error('unexpected buffer response: ' + JSON.stringify(bufferResponse));
	}
	console.log('OK: buffer round trip:', bufferResponse.text1, bufferResponse.text2);

	// 5) NaniumStream round trip
	const streamResponse: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
		{ amount: 4, msGapTime: 10 }, { token: '1234' } as any).execute();
	const streamed: TestDto[] = [];
	for await (const chunk of streamResponse) {
		streamed.push(chunk);
	}
	if (streamed.length !== 4) {
		throw new Error('unexpected stream length: ' + streamed.length);
	}
	console.log('OK: stream round trip, items:', streamed.length);

	await Nanium.shutdown();
	console.log('ALL GOOD');
	process.exit(0);
}

main().catch((err) => {
	console.error('FAILED', err);
	process.exit(1);
});

