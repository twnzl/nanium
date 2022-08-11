import { Component } from '@angular/core';
import { TestGetRequest, TestGetResponseBody } from '../../../services/test/get.contract';
import { ServiceResponseBase } from '../../../services/serviceResponseBase';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent {
	testGetResponse?: ServiceResponseBase<TestGetResponseBody>;
	error?: any;

	async test1(): Promise<void> {
		try {
			this.testGetResponse = await new TestGetRequest({ input1: 'hello world' }).execute();
		} catch (e) {
			this.error = e;
		}
	}

	// execute request via the consumer

}
