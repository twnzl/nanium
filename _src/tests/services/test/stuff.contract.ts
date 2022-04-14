import { ServiceRequestBase } from '../serviceRequestBase';
import { NaniumObject, RequestType, Type } from '../../../objects';

export class GenericStuff<TStuffSubType> extends NaniumObject<GenericStuff<TStuffSubType>> {
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

export class StuffDictionary<T> {
	[key: string]: T;
}

export class Stuff<TStuffSubType> extends NaniumObject<Stuff<TStuffSubType>> {
	aString?: string;
	@Type(Number) aNumber?: number;
	@Type(Boolean) aBoolean?: boolean;
	@Type(String) aStringEnum?: StuffStringEnum;
	@Type(Number) aNumberEnum?: StuffNumberEnum;
	@Type(Array, String) aStringEnumArray?: StuffStringEnum[];
	@Type(Array, Number) aNumberEnumArray?: StuffNumberEnum[];
	@Type(Date) aDate?: Date;
	@Type(Stuff) anObject?: Stuff<TStuffSubType>;
	@Type(Stuff) anObjectArray?: Stuff<TStuffSubType>[];
	@Type(Array, String) aStringArray?: string[];
	@Type(Array, Number) aNumberArray?: number[];
	@Type(Array, Number) anotherNumberArray?: number[];
	@Type(GenericStuff) aGenericObject?: GenericStuff<TStuffSubType>;
	@Type(GenericStuff) aGenericObjectArray?: GenericStuff<TStuffSubType>[];
	@Type(GenericStuff, { 'TStuffSubType': Boolean }) anObjectWithFixedGeneric: GenericStuff<Boolean>;
	@Type(StuffDictionary, Number) aNumberDictionary: StuffDictionary<Number>;
	@Type(Object, Boolean) aBooleanDictionary: { [key: string]: Boolean };

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
