import { ServiceExecutionScope } from '../../../interfaces/serviceExecutionScope';
import { ServiceRequestHead } from '../serviceRequestHead';
import { ServiceRequestContext } from '../serviceRequestContext';
import { Nocat } from '../../../core';
import { Observable } from 'rxjs';
import { ServiceRequestQueueEntry } from '../../../interfaces/serviceRequestQueueEntry';
import { MyServiceRequestQueueEntry } from '../serviceRequestQueueEntry';
import { NocatPropertyInfoCore, NocatRequestInfo } from '../../../serializers/jsonToClass';

export function Type(c: new () => any): Function {
	return (target: new () => any, propertyKey: string) => {
		target.constructor['__propertyInfo__'] = target.constructor['__propertyInfo__'] ?? {};
		target.constructor['__propertyInfo__'][propertyKey] = new NocatPropertyInfoCore(c);
	};
}

export function GenericType(genericTypeId: string): Function {
	return (target: new () => any, propertyKey: string) => {
		target.constructor['__propertyInfo__'] = target.constructor['__propertyInfo__'] ?? {};
		target.constructor['__propertyInfo__'][propertyKey] = new NocatPropertyInfoCore(undefined, genericTypeId);
	};
}

export function NocatRequest(info: NocatRequestInfo): Function {
	return (target: new () => any) => {
		target['__responseType__'] = info.responseType;
		target['__genericTypes__'] = info.genericTypes;
	};
}


export class GenericStuff<TStuffSubType> {
	constructor(data?: Partial<GenericStuff<TStuffSubType>>) {
		if (data) {
			this.aString = data.aString;
			this.aNumber = data.aNumber;
			this.aBoolean = data.aBoolean;
			this.theGeneric = data.theGeneric;
		}
	}

	aString?: string;
	aNumber?: number;
	aBoolean?: boolean;

	@GenericType('TStuffSubType')
	theGeneric?: TStuffSubType;
}


export enum StuffEnum {
	zero = 'z',
	one = 'o',
	two = 't'
}

export class Stuff<TStuffSubType> {

	constructor(data?: Partial<Stuff<TStuffSubType>>) {
		if (data) {
			this.aString = data.aString;
			this.aNumber = data.aNumber;
			this.aBoolean = data.aBoolean;
			this.anEnum = data.anEnum;
			this.aDate = data.aDate;
			this.anObject = data.anObject;
			this.anObjectArray = data.anObjectArray;
			this.aStringArray = data.aStringArray;
			this.aGenericObject = data.aGenericObject;
			this.aGenericObjectArray = data.aGenericObjectArray;
		}
	}

	aString?: string;
	aNumber?: number;
	aBoolean?: boolean;
	anEnum?: StuffEnum;

	@Type(Date)
	aDate?: Date;

	@Type(Stuff)
	anObject?: Stuff<TStuffSubType>;

	@Type(Stuff)
	anObjectArray?: Stuff<TStuffSubType>[];

	aStringArray?: string[];

	@Type(GenericStuff)
	aGenericObject?: GenericStuff<TStuffSubType>;

	@Type(GenericStuff)
	aGenericObjectArray?: GenericStuff<TStuffSubType>[];

	get aCalculatedProperty(): string {
		return this.aStringArray?.join(' ');
	}

	aFunction(): number {
		return this.aStringArray?.length;
	}
}

@NocatRequest({
	responseType: Stuff,
	genericTypes: {
		TStuffSubType: Date,
		// TRequestBody: Stuff,
		// TResponseBody: Stuff,
		// TPartialResponse: Stuff
	}
})
export class StuffRequest { // extends ServiceRequestBase<Stuff, Stuff[]> {
	static serviceName: string = 'NocatSelf.Stuff';
	static scope: ServiceExecutionScope = 'public';

	@Type(ServiceRequestHead)
	head: ServiceRequestHead;

	@Type(Stuff)
	body: Stuff<Date>; // TRequestBody;

	constructor(body?: Partial<Stuff<Date>>, head?: ServiceRequestHead) {
		this.body = body as Stuff<Date>;
		this.head = head;
	}

	async execute(context: ServiceRequestContext): Promise<Stuff<Date>[]> {
		return await Nocat.execute(this, undefined, context);
	}

	stream(): Observable<Stuff<Date>> {
		return Nocat.stream(this);
	}

	async enqueue(mandatorId: string, options?: Partial<ServiceRequestQueueEntry>): Promise<ServiceRequestQueueEntry> {
		const serviceName: string = (this.constructor as any).serviceName;
		return await Nocat.enqueue(
			<MyServiceRequestQueueEntry>{ serviceName: serviceName, request: this, ...options, mandatorId: mandatorId });
	}
}
