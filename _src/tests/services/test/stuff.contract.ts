import { RequestType, Type } from '../../../serializers/core';
import { ServiceRequestBase } from '../serviceRequestBase';

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

	@Type('TStuffSubType')
	theGeneric?: TStuffSubType;
}


export enum StuffStringEnum {
	zero = 'z',
	one = 'o',
	two = 't'
}

export enum StuffNumberEnum {
	zero,
	one,
	two
}

export class Stuff<TStuffSubType> {

	constructor(data?: Partial<Stuff<TStuffSubType>>) {
		if (data) {
			this.aString = data.aString;
			this.aNumber = data.aNumber;
			this.aBoolean = data.aBoolean;
			this.aStringEnum = data.aStringEnum;
			this.aDate = data.aDate;
			this.anObject = data.anObject;
			this.anObjectArray = data.anObjectArray;
			this.aStringArray = data.aStringArray;
			this.aNumberArray = data.aNumberArray;
			this.aGenericObject = data.aGenericObject;
			this.aGenericObjectArray = data.aGenericObjectArray;
			this.anObjectWithFixedGeneric = data.anObjectWithFixedGeneric;
		}
	}

	aString?: string;

	@Type(Number)
	aNumber?: number;

	@Type(Boolean)
	aBoolean?: boolean;

	aStringEnum?: StuffStringEnum;

	@Type(Number)
	aNumberEnum?: StuffNumberEnum;

	@Type(Array, String) aStringEnumArray?: StuffStringEnum[];
	@Type(Array, Number) aNumberEnumArray?: StuffNumberEnum[];

	@Type(Date)
	aDate?: Date;

	@Type(Stuff)
	anObject?: Stuff<TStuffSubType>;

	@Type(Stuff)
	anObjectArray?: Stuff<TStuffSubType>[];

	aStringArray?: string[];

	@Type(Array, Number)
	aNumberArray?: number[];

	@Type(Array, Number)
	anotherNumberArray?: number[];

	@Type(GenericStuff)
	aGenericObject?: GenericStuff<TStuffSubType>;

	@Type(GenericStuff)
	aGenericObjectArray?: GenericStuff<TStuffSubType>[];

	@Type(GenericStuff, { 'TStuffSubType': Boolean })
	anObjectWithFixedGeneric: GenericStuff<Boolean>;

	get aCalculatedProperty(): string {
		return this.aStringArray?.join(' ');
	}

	aFunction(): number {
		return this.aStringArray?.length;
	}
}

@RequestType({
	responseType: Stuff,
	genericTypes: {
		TStuffSubType: Date,
		TRequestBody: Stuff,
		TResponseBody: Stuff,
		TPartialResponse: Stuff
	},
	scope: 'public'
})
export class StuffRequest extends ServiceRequestBase<Stuff<Date>, Stuff<Date>[]> {
	static serviceName: string = 'NaniumTest:test/stuff';
}
