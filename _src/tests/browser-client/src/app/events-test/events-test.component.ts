import { Component, OnInit } from '@angular/core';
import { EventSubscription } from '../../../../../interfaces/eventSubscription';
import { StuffEvent } from '../../../../events/test/stuffEvent';
import { TestGetRequest } from '../../../../services/test/get.contract';
import { TestService } from '../test.service';
import { session } from '../../../../session';

@Component({
	selector: 'app-events-test',
	templateUrl: './events-test.component.html',
	styleUrls: ['./events-test.component.css']
})
export class EventsTestComponent implements OnInit {

	log: string[] = [];
	port: 8080 | 8081;
	mySession = session;
	subscriptions: EventSubscription[] = [];
	eventNumber: number = 1;

	constructor(
		public testService: TestService,
	) {
	}

	ngOnInit(): void {
	}

	connect(port: 8080 | 8081) {
		this.port = port;
		this.log.push('connected to ' + port);
		this.testService.init(port, port);
	}

	async emit() {
		try {
			await new TestGetRequest({ input1: 'hello world', cnt: this.eventNumber++ }).execute(); // causes an emission of StuffCreatedEvent
		} catch (e) {
			this.log.push('error: ' + (e?.message ?? e));
		}
	}

	async subscribe() {
		try {
			this.log.push('subscribe event');
			this.subscriptions.push(
				await StuffEvent.subscribe((event: StuffEvent) => {
					this.log.push('event received: ' + event.aNumber);
				}, this.testService.naniumConsumer)
			);
		} catch (e) {
			this.log.push('error: ' + (e?.message ?? e));
		}
	}

	async unsubscribe(subscription: EventSubscription) {
		try {
			this.log.push('unsubscribe event ' + subscription.id);
			await subscription.unsubscribe();
			this.subscriptions = this.subscriptions.filter(s => s.id !== subscription.id);
		} catch (e) {
			this.log.push('error: ' + (e?.message ?? e));
		}
	}
}
