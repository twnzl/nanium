import { Component, OnInit } from '@angular/core';
import { Nanium } from '../../../../core';
import { AsyncHelper } from '../../../../helper';
import { EventSubscription } from '../../../../interfaces/eventSubscription';
import { NaniumBuffer } from '../../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../../interfaces/naniumStream';
import { NaniumConsumerBrowserHttp } from '../../../../managers/consumers/browserHttp';
import { NaniumConsumerBrowserWebsocket } from '../../../../managers/consumers/browserWs';
import { NaniumJsonSerializer } from '../../../../serializers/json';
import { Stuff2Event } from '../../../events/test/stuff2Event';
import { StuffEvent } from '../../../events/test/stuffEvent';
import { TestClientRequestInterceptor } from '../../../interceptors/client/test.request.interceptor';
import { TestClientResponseInterceptor } from '../../../interceptors/client/test.response.interceptor';
import { TestEventSubscriptionSendInterceptor } from '../../../interceptors/client/test.send-event-subscription.interceptor';
import { TestBufferRequest } from '../../../services/test/buffer.contract';
import { TestDto } from '../../../services/test/contractparts';
import { TestGetRequest } from '../../../services/test/get.contract';
import { TestGetBinaryRequest } from '../../../services/test/getBinary.contract';
import { TestStreamedBinaryRequest } from '../../../services/test/streamedBinary.contract';
import { TestStreamedQueryRequest } from '../../../services/test/streamedQuery.contract';
import { TestUpstreamBinaryRequest } from '../../../services/test/upstreamBinary.contract';
import { TestUpstreamObjectsRequest } from '../../../services/test/upstreamObjects.contract';
import { session } from '../../../session';
import { TestService } from './test.service';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
	constructor(
		public testService: TestService
	) {
	}

	async ngOnInit() {
	}

	async simple(): Promise<void> {
		try {
			if (!Nanium.managers?.length) {
				await this.testService.init();
			}
			const response = await new TestGetRequest({ input1: 'hello world' }).execute();
			if (response.body.output1 !== 'hello world :-)') {
				throw new Error('unexpected response: ' + response.body.output1);
			} else {
				console.log('✅ simple: received expected response');
			}
		} catch (e) {
			console.log(e);
			alert('An error occurred. see console for details.');
		}
	}

	async buffers(): Promise<void> {
		try {
			await this.testService.init();
			const request = new TestBufferRequest({
				id: '1',
				buffer1: new NaniumBuffer().writeString('123'),
				buffer2: new NaniumBuffer().writeString('456'),
			});
			const response = await request.execute();
			console.log(response.id === '1');
			console.log(response.text1 === '123*');
			console.log(response.text2 === '456*');
		} catch (e) {
			console.log(e);
			alert('An error occurred. see console for details.');
		}
	}

	async unsubscribeWithoutParameters(): Promise<{ event1: StuffEvent, event2: Stuff2Event }> {
		await this.testService.init();
		session.token = '1234'; // reset right credentials
		const manager = Nanium.managers.find(m => (m as NaniumConsumerBrowserHttp).config.apiUrl.includes('8080'));
		let event1: StuffEvent;
		let event2: Stuff2Event;
		await StuffEvent.subscribe((event) => event1 = event, undefined, manager);
		await Stuff2Event.subscribe((event) => event2 = event, undefined, manager);
		await Stuff2Event.unsubscribe();
		await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
		await AsyncHelper.pause(1000);
		await StuffEvent.unsubscribe();
		return { event1, event2 };
	}

	// execute request via the consumer
	async objectResponseStream() {
		await this.testService.init();
		const stream: NaniumStream<TestDto> = await new TestStreamedQueryRequest({ amount: 6, msGapTime: 500 }).execute();
		// const result = await stream.toPromise();
		const result: TestDto[] = [];
		for await (const dto of stream) {
			result.push(dto as TestDto);
			console.log(JSON.stringify(dto));
		}
		console.log(JSON.stringify(result));
	}

	async objectResponseStreamPromise() {
		await this.testService.init();
		const result = await (await new TestStreamedQueryRequest({ amount: 3, msGapTime: 10 }).execute()).toPromise();
		console.log(JSON.stringify(result));
	}

	async binaryResponseStream() {
		await this.testService.init();
		const stream = await new TestStreamedBinaryRequest({ amount: 3, msGapTime: 500 }).execute();
		const result: NaniumBuffer = new NaniumBuffer();
		for await (const chunk of stream) {
			result.write(chunk);
			const text = await chunk.asString();
			console.log(text);
		}
		if ((await result.asString()) !== '1.2.3.') {
			throw new Error('expected result: "1.2.3." but received: ' + await result.asString());
		} else {
			console.log('✅ binaryResponseStream: received expected result: ' + await result.asString());
		}
	}


	//#region ws
	async wsSimple(): Promise<void> {
		this.testService.initWs(8080, 1);
		await this.simple();
	}

	async wsBufferResponse(): Promise<void> {
		this.testService.initWs(8080, 1);
		const request = new TestGetBinaryRequest();
		const response = await request.execute();
		const text = new TextDecoder().decode(await response.asUint8Array());
		if (text !== 'this is a text that will be send as binary data') {
			throw new Error('response content mismatch: ' + text);
		} else {
			console.log('✅ wsBufferResponse: received expected binary data');
		}
	}

	async wsBufferRequest() {
		this.testService.initWs(8080, 1);
		const request = new TestBufferRequest({
			id: '1',
			buffer1: new NaniumBuffer().writeString('123'),
			buffer2: undefined,
		});
		const response = await request.execute();
		const txt1 = await response.buffer1.asString();
		if (txt1 !== '123*') {
			throw new Error('response.buffer1 should have same content as request.buffer1 + "*" but received: ' + txt1);
		}
		if (response.buffer2 !== undefined) {
			throw new Error('response.buffer2 should be undefined but received: ' + response.buffer2);
		}
		if (response.text1 !== '123*') {
			throw new Error('response.text1: should be the content of request.buffer1 + "*" as string but received: ' + response.text1);
		}
		if (response.text2 !== undefined) {
			throw new Error('response.text2: should be the content of request.buffer2 as string but received: ' + response.text2);
		}
		console.log('✅ wsBufferRequest: received expected result');
	}

	async wsStreamObjects() {
		this.testService.initWs(8080, 1);
		const dtoList: TestDto[] = [];
		let portions = 0;
		const response: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
			{ amount: 6, msGapTime: 100 }, { token: '1234' }
		).execute();
		for await (const dto of response) {
			portions++;
			console.log(dto);
			dtoList.push(dto);
		}
		if (dtoList.length !== 6) {
			throw new Error('expected length of result list: 6 but received: ' + dtoList.length);
		}
		if (dtoList[0].formatted() !== '1:1') {
			throw new Error('expected dtoList[0].formatted(): "1:1" but received: ' + dtoList[0].formatted());
		}
		if (dtoList[2].formatted() !== '3:3') {
			throw new Error('expected dtoList[2].formatted(): "3:3" but received: ' + dtoList[2].formatted());
		}
		console.log('✅ wsStreamObjects: received expected result');
	}

	async wsStreamBinary() {
		this.testService.initWs(8080, 1);
		try {
			const stream = await new TestStreamedBinaryRequest({ amount: 3, msGapTime: 500 }).execute();

			// todo: problem ist, dass durch das await auf die response, der Inhalt des streams bereits übertragen wird
			// und dann ohne onData - function (in browserWs.handleResponseStreamChunk) entgegengenommen wird,
			// noch bevor es hier mit der Ausführung weiter geht und die onData - function registriert werden kann.
			// wie kann ich sicher stellen, dass die Ausführung hier weiter geht, bevor der Inhalt des streams entgegengenommen wird ?

			const result: NaniumBuffer = new NaniumBuffer();
			for await (const chunk of stream) {
				result.write(chunk);
				console.log(await new NaniumBuffer(chunk).asString());
			}
			if ((await result.asString()) !== '1.2.3.') {
				throw new Error('expected result: "1.2.3." but received: ' + await result.asString());
			} else {
				console.log('✅ wsStreamBinary: received expected result: ' + await result.asString());
			}
		} catch (err) {
			console.error(err.message, err.stack);
		}
	}

	async wsStreamBinaryToServer() {
		this.testService.initWs(8080, 1);
		const upstream1 = new NaniumStream<NaniumBuffer>();
		const upstream2 = new NaniumStream<NaniumBuffer>();
		const request = new TestUpstreamBinaryRequest({});
		request.body.upstream1 = upstream1;
		request.body.upstream2 = upstream2;
		request.execute().then(result => {
			if (result.upstream1NumberOfReceivedBytes !== 12) {
				throw new Error('upstream1: expected length of received binary data: 12 but received: ' + result.upstream1NumberOfReceivedBytes);
			} else {
				console.log('✅ upstream1: length of received binary data:', result.upstream1NumberOfReceivedBytes);
			}
			if (result.upstream2NumberOfReceivedBytes !== 6) {
				throw new Error('upstream2: expected length of received binary data: 6 but received: ' + result.upstream2NumberOfReceivedBytes);
			} else {
				console.log('✅ upstream2: length of received binary data:', result.upstream2NumberOfReceivedBytes);
			}
		});
		const chunk = new NaniumBuffer(new TextEncoder().encode('abc'));
		let cnt = 1;
		const interval = setInterval(() => {
			if (cnt > 4) {
				clearInterval(interval);
				upstream1.end();
				upstream2.end();
			} else {
				upstream1.write(chunk);
				if (cnt < 3) {
					upstream2.write(chunk);
				}
			}
			cnt++
		}, 100);
	}

	async wsStreamObjectsToServer() {
		this.testService.initWs(8080, 1);
		const request = new TestUpstreamObjectsRequest({});
		request.body.upstream1 = new NaniumStream<TestDto>();
		request.body.upstream2 = new NaniumStream<TestDto>();
		let cnt = 1;
		const interval = setInterval(() => {
			if (cnt > 4) {
				clearInterval(interval);
				request.body.upstream1.end();
				request.body.upstream2.end();
			} else {
				request.body.upstream1.write(new TestDto(cnt.toString(), cnt));
				if (cnt < 3) {
					request.body.upstream2.write(new TestDto(cnt.toString(), cnt));
				}
			}
			cnt++
		}, 100);
		const response = await request.execute();
		if (response.receivedObjects1?.length !== 4) {
			throw new Error('upstream1: expected number of received objects: 4 but received: ' + response.receivedObjects1?.length);
		} else {
			console.log('✅ upstream1: number of received objects:', response.receivedObjects1?.length);
		}
		if (response.receivedObjects1[0].a !== '1' || response.receivedObjects1[0].b !== 1) {
			throw new Error('upstream1: expected first object: {a:"1", b:1} but received: ' + response.receivedObjects1[0].a);
		} else {
			console.log('✅ upstream1: first object correct: {a:"1", b:1}');
		}
		if (response.receivedObjects2?.length !== 2) {
			throw new Error('upstream2: expected number of received objects: 2 but received: ' + response.receivedObjects2?.length);
		} else {
			console.log('✅ upstream2: number of received objects:', response.receivedObjects2?.length);
		}
	}

	async wsUpstreamDataTimeout() {
		this.testService.initWs(8080, 1);
		const upstream1 = new NaniumStream<NaniumBuffer>();
		const request = new TestUpstreamBinaryRequest({});
		request.body.upstream1 = upstream1;
		const responsePromise = request.execute();
		const chunk = new NaniumBuffer(new TextEncoder().encode('abc'));
		let cnt = 1;
		try {
			const interval = setInterval(() => {
				if (cnt > 2) {
					clearInterval(interval);
					AsyncHelper.pause(6000).then(() => upstream1.end());
				} else {
					upstream1.write(chunk);
				}
				cnt++
			}, 100);
			await responsePromise;
			throw new Error('wsStreamDataTimeout: upstream1: should have been run into data timeout');
		} catch (e) {
			if (e instanceof Error && e.message.includes('timeout')) {
				console.log('✅ wsStreamDataTimeout: upstream1: timeout occurred as expected');
			} else {
				throw e;
			}
		}
	}

	async tmp() {
		// this.testService.initWs(8080, 1);
		session.token = '1234';
		session.tenant = 'Company1';
		await addHttpConsumer('http://localhost:8080', 1, 0);
		await addHttpConsumer('http://localhost:8081', 1, 0);
		const manager1 = await addWebsocketConsumer('ws://localhost:8080', 0, 1);
		const manager2 = await addWebsocketConsumer('ws://localhost:8081', 0, 1);
		const manager3 = await addWebsocketConsumer('ws://localhost:8081', 0, 1); // for two different client-IDs connected with the same server

		let event1: StuffEvent;
		let event2: StuffEvent;
		session.token = '1234'; // reset right credentials
		session.tenant = 'Company1';
		const subscription1: EventSubscription = await StuffEvent.subscribe((event) => {
			event1 = event;
		}, undefined, manager1);
		session.token = '5678'; // other tenant
		session.tenant = 'Company2';
		const subscription2: EventSubscription = await StuffEvent.subscribe((event) => {
			event2 = event;
		}, undefined, manager2);
		session.token = '1234'; // reset right credentials
		session.tenant = 'Company1';
		await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
		// await AsyncHelper.waitUntil(() => !!event1, 100, 2000);
		await AsyncHelper.pause(1000);
		await subscription1.unsubscribe();
		await subscription2.unsubscribe();

	}
	//#endregion ws
}

async function addHttpConsumer(
	baseUrl: string = 'http://localhost:8080',
	serviceResponsibility: number = 1,
	eventResponsibility: number = 1
): Promise<NaniumConsumerBrowserHttp> {
	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';
	const naniumConsumer = new NaniumConsumerBrowserHttp({
		apiUrl: baseUrl + '/api',
		apiEventUrl: baseUrl + '/events',
		serializer: serializer,
		requestInterceptors: [TestClientRequestInterceptor],
		responseInterceptors: [TestClientResponseInterceptor],
		eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
		isResponsible: () => Promise.resolve(serviceResponsibility),
		isResponsibleForEvent: () => Promise.resolve(eventResponsibility),
		handleError: async (err: any): Promise<any> => Promise.reject({ handleError: err })
	});
	await Nanium.addManager(naniumConsumer);
	return naniumConsumer;
}

async function addWebsocketConsumer(
	baseUrl: string = 'ws://localhost:8080',
	serviceResponsibility: number = 1,
	eventResponsibility: number = 1
): Promise<NaniumConsumerBrowserWebsocket> {
	const serializer = new NaniumJsonSerializer();
	serializer.packageSeparator = '\0';
	const naniumConsumer = new NaniumConsumerBrowserWebsocket({
		connectUrl: baseUrl,
		serializer: serializer,
		requestInterceptors: [TestClientRequestInterceptor],
		responseInterceptors: [TestClientResponseInterceptor],
		eventSubscriptionSendInterceptors: [TestEventSubscriptionSendInterceptor],
		isResponsible: () => Promise.resolve(serviceResponsibility),
		isResponsibleForEvent: () => Promise.resolve(eventResponsibility),
		handleError: (err: any) => Promise.reject({ handleError: err }),
	});
	await Nanium.addManager(naniumConsumer);
	return naniumConsumer;
}