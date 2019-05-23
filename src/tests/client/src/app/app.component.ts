import {Component, OnInit} from '@angular/core';
import TestRequest from '../../../services/contracts/test.request';
import Nocat from '../../../../core';
import NocatClient from '../../../../client';

@Component({
	selector: 'app-root',
	templateUrl: './app.component.html',
	styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
	title: string = 'client';

	async ngOnInit(): Promise<void> {
		Nocat.init(new NocatClient());
		const result: string = await new TestRequest({input1: 'hello world'}).execute();
		alert(result);
	}
}
