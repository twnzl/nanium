import { ServiceRequestHead } from './serviceRequestHead';
import { Nanium } from '../../core';
import { Observable } from 'rxjs';

export class StreamServiceRequestBase<TRequestBody, TResult> {

	head: ServiceRequestHead;
	body: TRequestBody;

	constructor(body?: TRequestBody, head?: ServiceRequestHead) {
		this.body = body;
		this.head = head;
	}

	async execute(): Promise<Array<TResult>> {
		return await new Promise<TResult[]>((resolve, reject) => {
			const result: TResult[] = [];
			this.stream().subscribe({
				next: (value: TResult): void => {
					result.push(value);
				},
				complete: (): void => {
					resolve(result);
				},
				error: (e: any): void => {
					reject(e);
				}
			});
		});
	}

	stream(): Observable<TResult> {
		return Nanium.stream(this);
	}
}
