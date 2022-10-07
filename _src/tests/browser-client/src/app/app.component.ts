import { Component, OnInit } from '@angular/core';
import { TestGetRequest, TestGetResponseBody } from '../../../services/test/get.contract';
import { ServiceResponseBase } from '../../../services/serviceResponseBase';
import { NaniumBuffer } from '../../../../interfaces/naniumBuffer';
import { TestBufferRequest } from '../../../services/test/buffer.contract';
import { NaniumJsonSerializer } from '../../../../serializers/json';
import { NaniumConsumerBrowserHttp } from '../../../../managers/consumers/browserHttp';
import { TestClientRequestInterceptor } from '../../../interceptors/client/test.request.interceptor';
import { Nanium } from '../../../../core';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
	testGetResponse?: ServiceResponseBase<TestGetResponseBody>;
	error?: any;

	async ngOnInit() {
		this.initNanium();
	}

	initNanium(baseUrl: string = 'http://localhost:8080'): void {
		const serializer = new NaniumJsonSerializer();
		serializer.packageSeparator = '\0';
		const naniumConsumer = new NaniumConsumerBrowserHttp({
			apiUrl: baseUrl + '/api',
			apiEventUrl: baseUrl + '/events',
			serializer: serializer,
			requestInterceptors: [TestClientRequestInterceptor],
			handleError: async (err: any): Promise<any> => {
				throw { handleError: err };
			}
		});
		Nanium.addManager(naniumConsumer).then();
	}

	async test1(): Promise<void> {
		try {
			this.testGetResponse = await new TestGetRequest({ input1: 'hello world' }).execute();
		} catch (e) {
			this.error = e;
		}
	}

	async test2(): Promise<void> {
		try {
			const request = new TestBufferRequest({
				id: '1',
				buffer1: new NaniumBuffer('123'),
				buffer2: new NaniumBuffer('456')
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


	// execute request via the consumer

}
