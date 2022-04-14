import { ServiceRequestHead } from './serviceRequestHead';
import { Nanium } from '../../core';
import { Observable } from 'rxjs';
import { ConstructorType, NaniumObject } from '../../objects';

export class StreamServiceRequestBase<TRequestBody, TResult> {

	head: ServiceRequestHead;
	body: TRequestBody;

	constructor(body?: TRequestBody, head?: Partial<ServiceRequestHead>) {
		this.body = body ? NaniumObject.create(body, 'TRequestBody', this.constructor as ConstructorType) : undefined;
		this.head = head ? new ServiceRequestHead(head) : undefined;
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
