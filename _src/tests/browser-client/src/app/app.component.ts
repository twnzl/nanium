import { Component, OnInit } from '@angular/core';
import { Nanium } from '../../../../core';
import { AsyncHelper } from '../../../../helper';
import { NaniumBuffer } from '../../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../../interfaces/naniumStream';
import { NaniumConsumerBrowserHttp } from '../../../../managers/consumers/browserHttp';
import { Stuff2Event } from '../../../events/test/stuff2Event';
import { StuffEvent } from '../../../events/test/stuffEvent';
import { TestBufferRequest } from '../../../services/test/buffer.contract';
import { TestDto } from '../../../services/test/contractparts';
import { TestGetRequest } from '../../../services/test/get.contract';
import { TestGetBinaryRequest } from '../../../services/test/getBinary.contract';
import { TestStreamedBinaryRequest } from '../../../services/test/streamedBinary.contract';
import { TestStreamedQueryRequest } from '../../../services/test/streamedQuery.contract';
import { TestUpstreamBinaryRequest } from '../../../services/test/upstreamBinary.contract';
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
			console.log(response.body.output1);
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
		const stream = await new TestStreamedQueryRequest({ amount: 6, msGapTime: 500 }).execute();
		// const result = await stream.toPromise();
		const result: TestDto[] = [];
		(stream as NaniumStream).onData(dto => {
			result.push(dto as TestDto);
			console.log(JSON.stringify(dto));
			return Promise.resolve();
		}).onEnd(() => {
			console.log(JSON.stringify(result));
		});
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
		stream.onData(async (chunk) => {
			await result.write(chunk);
			const text = await chunk.asString();
			console.log(text);
		}).onEnd(async () => {
			console.log(await result.asString());
		});
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
		console.log(text, text === 'this is a text that will be send as binary data');
	}

	async wsBufferRequest() {
		this.testService.initWs(8080, 1);
		const request = new TestBufferRequest({
			id: '1',
			buffer1: new NaniumBuffer().writeString('123'),
			buffer2: undefined,
		});
		const response = await request.execute();
		console.log('response.buffer1 should have same content as request.buffer1 + "*":', await response.buffer1.asString());
		console.log('response.buffer2 should be undefined: ', response.buffer2);
		console.log('response.text1: should be the content of request.buffer1 + "*" as string:', response.text1);
		console.log('response.text2: should be the content of request.buffer2 as string:', response.text2);
	}

	async wsStreamObjects() {
		this.testService.initWs(8080, 1);
		const dtoList: TestDto[] = [];
		let portions = 0;
		await new Promise(async (resolve: Function): Promise<void> => {
			const response: NaniumStream<TestDto> = await new TestStreamedQueryRequest(
				{ amount: 6, msGapTime: 100 }, { token: '1234' }).execute();
			response.onData((value: TestDto): Promise<void> => {
				portions++;
				console.log(value);
				dtoList.push(value);
				return Promise.resolve();
			});
			response.onEnd(() => {
				resolve();
			});
			response.onError((err: Error) => {
				Nanium.logger.error(err.message, err.stack);
			});
		});
	}

	async wsStreamBinary() {
		this.testService.initWs(8080, 1);
		try {
			const stream = await new TestStreamedBinaryRequest({ amount: 3, msGapTime: 500 }).execute();

			// todo: problem ist, dass durch das await auf die response, der Inhalt des streams bereits übertragen wird
			// und dann ohne onData - function (in browserWs.handleResponseStreamChunk) entgegengenommen wird,
			// 	noch bevor es hier mit der Ausführung weiter geht und die onData - function registriert werden kann.
			// wie kann ich sicher stellen, dass die Ausführung hier weiter geht, bevor der Inhalt des streams entgegengenommen wird ?

			const result: NaniumBuffer = new NaniumBuffer();
			await new Promise((resolve: Function) => {
				stream.onData(async (chunk) => {
					result.write(chunk);
					console.log(new NaniumBuffer(chunk).asString()); //.toBe('1.2.3.');
				})
				stream.onEnd(async () => {
					console.log(await result.asString())
					resolve();
				});
			});
		} catch (err) {
			console.error(err.message, err.stack);
		}
	}

	wsStreamBinaryToServer() {
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

	wsStreamObjectsToServer() {
		throw new Error('Method not implemented.');
	}

	//#endregion ws
}
