import { Component, OnInit } from '@angular/core';
import { TestGetRequest, TestGetResponseBody } from '../../../services/test/get.contract';
import { ServiceResponseBase } from '../../../services/serviceResponseBase';
import { NaniumBuffer } from '../../../../interfaces/naniumBuffer';
import { TestBufferRequest } from '../../../services/test/buffer.contract';
import { TestService } from './test.service';
import { session } from '../../../session';
import { Nanium } from '../../../../core';
import { NaniumConsumerBrowserHttp } from '../../../../managers/consumers/browserHttp';
import { StuffEvent } from '../../../events/test/stuffEvent';
import { Stuff2Event } from '../../../events/test/stuff2Event';
import { AsyncHelper } from '../../../../helper';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
	testGetResponse?: ServiceResponseBase<TestGetResponseBody>;
	error?: any;

	constructor(
		public testService: TestService
	) {
	}

	async ngOnInit() {
	}

	async test1(): Promise<void> {
		try {
			this.testService.init();
			this.testGetResponse = await new TestGetRequest({ input1: 'hello world' }).execute();
		} catch (e) {
			this.error = e;
		}
	}

	async test2(): Promise<void> {
		try {
			this.testService.init();
			const request = new TestBufferRequest({
				id: '1',
				buffer1: new NaniumBuffer(new TextEncoder().encode('123')),
				buffer2: new NaniumBuffer(new TextEncoder().encode('456'))
			});
			const response = await request.execute();
			console.log(response.id === '1');
			console.log(response.text1 === '123*');
			console.log(response.text2 === '456*');
			// console.log(response.buffer1.asString() === '123*');
			// console.log(response.buffer2.asString() === '456*');
		} catch (e) {
			this.error = e;
		}
	}

	async unsubscribeWithoutParameters(): Promise<{ event1: StuffEvent, event2: Stuff2Event }> {
		this.testService.init();
		session.token = '1234'; // reset right credentials
		const manager = Nanium.managers.find(m => (m as NaniumConsumerBrowserHttp).config.apiUrl.includes('8080'));
		let event1: StuffEvent;
		let event2: Stuff2Event;
		await StuffEvent.subscribe((event) => event1 = event, manager);
		await Stuff2Event.subscribe((event) => event2 = event, manager);
		await Stuff2Event.unsubscribe();
		await new TestGetRequest({ input1: 'hello world' }).execute(); // causes an emission of StuffCreatedEvent
		await AsyncHelper.pause(1000);
		await StuffEvent.unsubscribe();
		return { event1, event2 };
	}

	// execute request via the consumer
}
