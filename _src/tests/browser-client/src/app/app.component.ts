import { Component, OnInit } from '@angular/core';
import { TestGetRequest, TestGetResponseBody } from '../../../services/test/get.contract';
import { ServiceResponseBase } from '../../../services/serviceResponseBase';
import { TestMeasurementDataConvertRequest } from '../../../services/test/measurement/data/convert.contract';
import { NaniumStream } from '../../../../interfaces/naniumStream';
import { NaniumBuffer } from '../../../../interfaces/naniumBuffer';
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

	ngOnInit(): void {
		this.initNanium();
	}

	async test1(): Promise<void> {
		try {
			this.testGetResponse = await new TestGetRequest({ input1: 'hello world' }).execute();
		} catch (e) {
			this.error = e;
		}
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

	async test2(): Promise<void> {
		try {
			await new Promise<void>(async (resolve: Function) => {
				// send request
				const request = new TestMeasurementDataConvertRequest({
					measurementId: '42',
					// values: new NaniumStream<Number>(),
					video: new NaniumStream<NaniumBuffer>()
				});
				// receive response with id and the two response streams
				const response = await request.execute();
				expect(response.measurementId).toBe('42*');

				// stream data of the two streams
				// request.body.values.next(1);
				request.body.video.next(new NaniumBuffer('123'));
				// request.body.values.next(2);
				request.body.video.next(new NaniumBuffer(['45', '6']));
				// request.body.values.next(3);
				request.body.video.next(new NaniumBuffer('789'));
				request.body.video.complete();

				// receive data of the two response streams and when ready test the result
				const resultVideo: NaniumBuffer = new NaniumBuffer();
				// const resultValues: number[] = [];
				let resultValuesReady: boolean;
				// let resultVideoReady: boolean;
				// response.convertedValues.subscribe({
				// 	next: (part) => {
				// 		resultValues.push(part);
				// 	},
				// 	complete: () => {
				// 		expect(resultValues.length).toBe(3);
				// 		expect(resultValues[0]).toBe(2);
				// 		expect(resultValues[1]).toBe(4);
				// 		expect(resultValues[2]).toBe(6);
				//
				// 	}
				// });
				response.convertedVideo.subscribe({
					next: (part) => {
						resultVideo.write(part);
					},
					complete: () => {
						expect(resultVideo.length).toBe(10);
						expect(new TextDecoder().decode(resultVideo.asUint8Array())).toBe('2345678910');
						if (resultValuesReady) {
							resolve();
						}
					}
				});
			});

		} catch (e) {
			this.error = e;
		}
	}

	// execute request via the consumer

}

function expect(actual: any): any {
	return {
		toBe: (expected) => {
			if (expected !== actual) {
				throw new Error('expected: ' + expected + '\nactual: ' + actual);
			}
		}
	};
}
