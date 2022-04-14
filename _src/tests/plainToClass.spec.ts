import {
	GenericStuff,
	Stuff,
	StuffDictionary,
	StuffNumberEnum,
	StuffRequest,
	StuffStringEnum
} from './services/test/stuff.contract';
import { ServiceRequestContext } from './services/serviceRequestContext';
import { TestHelper } from './testHelper';
import { ServiceResponseBase } from './services/serviceResponseBase';
import { NaniumObject } from '../objects';

let request: StuffRequest = null;
let response: ServiceResponseBase<Stuff<Date>[]>;
const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });

describe('JsonToClassSerializer \n', function (): void {
	beforeAll(async () => {
		await TestHelper.initClientServerScenario('http');
	});

	afterAll(async () => {
		await TestHelper.shutdown();
	});

	describe('execute with all types of properties set in the request \n', function (): void {
		beforeEach(async () => {
			request = getRequest();
			response = await request.execute(executionContext);
		});

		it(
			'--> the request and all its properties should have the right types on the server \n' +
			' and the response and all its properties should have the right types on the client ',
			async () => {
				// if something is wrong with the request on the server an exception would be thrown;
				expect(Array.isArray(response)).toBeTruthy();
				expect(response[0] instanceof Stuff).toBeTruthy();
				expect(response[0].aDate instanceof Date).toBeTruthy();
				expect(response[0].aDate.toISOString()).toBe(new Date(1600000000000).toISOString());
				expect(response[0].aBoolean).toBe(true);
				expect(response[0].aNumber).toBe(42);
				expect(response[0].aString).toBe('hello');
				expect(response[0].aStringArray[0]).toBe('hello');
				expect(response[0].aStringArray[1]).toBe('world');
				expect(response[0].aNumberArray[0]).toBe(1);
				expect(response[0].aNumberArray[1]).toBe(2);
				expect(response[0].anotherNumberArray[0]).toBe(3);
				expect(response[0].aStringEnum).toBe(StuffStringEnum.one);
				expect(response[0].aNumberEnum).toBe(StuffNumberEnum.two);
				expect(response[0].anObject instanceof Stuff).toBeTruthy();
				expect(response[0].anObject.aNumber).toBe(46);
				expect(response[0].anObjectArray[0] instanceof Stuff).toBeTruthy();
				expect(response[0].anObjectArray[0].aNumber).toBe(43);
				expect(response[0].aCalculatedProperty).toBe('hello world');
				expect(response[0].aFunction()).toBe(2);
				expect(response[0].aGenericObject instanceof GenericStuff).toBeTruthy();
				expect((response[0].aGenericObject as GenericStuff<Date>).theGeneric instanceof Date).toBeTruthy();
				expect((response[0].aGenericObject as GenericStuff<Date>).theGeneric.toISOString()).toBe(new Date(1600000000005).toISOString());
				expect(response[0].aGenericObjectArray[0] instanceof GenericStuff).toBeTruthy();
				expect(response[0].aGenericObjectArray[0].theGeneric instanceof Date).toBeTruthy();
				expect((response[0].aGenericObjectArray[0] as GenericStuff<Date>).theGeneric.toISOString()).toBe(new Date(1600000000006).toISOString());
				expect((response[0].anObjectWithFixedGeneric as GenericStuff<Boolean>).theGeneric).toBe(true);
				expect(response[0].aNumberDictionary instanceof StuffDictionary).toBe(true);
				expect((response[0].aNumberDictionary as StuffDictionary<Number>).a).toBe(1);
				expect((response[0].aNumberDictionary as StuffDictionary<Number>).b).toBe(2);
				expect((response[0].aBooleanDictionary).a).toBe(true);
				expect((response[0].aBooleanDictionary).b).toBe(false);
			});
	});
});

describe('plainToClass \n', function (): void {
	describe('object not deserialized from json (e.g. from querystring)\n', function (): void {
		let request2: StuffRequest;
		beforeEach(async () => {
			request = getRequest();
			const strangeRequest: any = await JSON.parse(JSON.stringify(request));
			strangeRequest.body.aBoolean = request.body.aBoolean.toString();
			strangeRequest.body.aDate = request.body.aDate.toString();
			strangeRequest.body.aStringEnum = request.body.aStringEnum.toString();
			strangeRequest.body.aNumberEnum = request.body.aNumberEnum.toString();
			strangeRequest.body.aStringEnumArray = request.body.aStringEnumArray[0].toString();
			strangeRequest.body.aNumberEnumArray = request.body.aNumberEnumArray[0].toString();
			strangeRequest.body.aNumber = request.body.aNumber.toString();
			strangeRequest.body.aNumberArray = request.body.aNumberArray.map(v => v.toString());
			strangeRequest.body.anotherNumberArray = strangeRequest.body.anotherNumberArray[0].toString();
			strangeRequest.body.aNumberDictionary = {
				a: request.body.aNumberDictionary.a.toString(),
				b: request.body.aNumberDictionary.b.toString()
			};
			strangeRequest.body.aBooleanDictionary = {
				a: request.body.aBooleanDictionary.a.toString(),
				b: request.body.aBooleanDictionary.b.toString()
			};
			request2 = NaniumObject.plainToClass(strangeRequest, StuffRequest);
		});

		it('-->  \n', async function (): Promise<void> {
			expect(request2.body.aNumber).toBe(request.body.aNumber);
			expect(request2.body.aBoolean).toBe(request.body.aBoolean);
			expect(request2.body.aDate.toString()).toBe(request.body.aDate.toString());
			expect(request2.body.aStringEnum).toBe(request.body.aStringEnum);
			expect(request2.body.aNumberEnum).toBe(request.body.aNumberEnum);
			expect(request2.body.aStringEnumArray[0]).toBe(request.body.aStringEnumArray[0]);
			expect(request2.body.aNumberEnumArray[0]).toBe(request.body.aNumberEnumArray[0]);
			expect(request2.body.aNumberArray[0]).toBe(request.body.aNumberArray[0]);
			expect(request2.body.aNumberArray[1]).toBe(request.body.aNumberArray[1]);
			expect(request2.body.anotherNumberArray[0]).toBe(request.body.anotherNumberArray[0]);
			expect(request2.body.aNumberDictionary.a).toBe(request.body.aNumberDictionary.a);
			expect(request2.body.aNumberDictionary.b).toBe(request.body.aNumberDictionary.b);
			expect(request2.body.aBooleanDictionary.a).toBe(request.body.aBooleanDictionary.a);
			expect(request2.body.aBooleanDictionary.b).toBe(request.body.aBooleanDictionary.b);
		});
	});
});

//#region helper
function getRequest(): StuffRequest {
	return new StuffRequest(
		{
			aBoolean: true,
			aDate: new Date(1600000000000),
			aString: 'hello',
			aStringArray: ['hello', 'world'],
			aNumberArray: [1, 2],
			anotherNumberArray: [3],
			aNumber: 42,
			aStringEnum: StuffStringEnum.one,
			aNumberEnum: StuffNumberEnum.two,
			aStringEnumArray: [StuffStringEnum.one],
			aNumberEnumArray: [StuffNumberEnum.two],
			anObjectArray: [
				new Stuff({
					aBoolean: true,
					aDate: new Date(1600000000001),
					aString: 'hello',
					aStringArray: ['hello', 'world'],
					aNumber: 43
				}), new Stuff({
					aBoolean: true,
					aDate: new Date(1600000000002),
					aString: 'hello',
					aStringArray: ['hello', 'world'],
					aNumber: 44,
					anObjectArray: [
						new Stuff({
							aBoolean: true,
							aDate: new Date(1600000000003),
							aString: 'hello',
							aStringArray: ['hello', 'world'],
							aNumber: 45,
						})
					]
				})
			],
			anObject: new Stuff<Date>({
				aBoolean: true,
				aDate: new Date(1600000000004),
				aString: 'hello',
				aStringArray: ['hello', 'world'],
				aNumber: 46
			}),
			aGenericObject: {
				theGeneric: new Date(1600000000005)
			},
			aGenericObjectArray: [
				new GenericStuff<Date>({
					theGeneric: new Date(1600000000006)
				})
			],
			anObjectWithFixedGeneric: new GenericStuff<Boolean>({ theGeneric: true }),
			aNumberDictionary: { a: 1, b: 2 },
			aBooleanDictionary: { a: true, b: false },
		},
		{ token: '1234' });
}

//#endregion helper
