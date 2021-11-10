import { GenericStuff, Stuff, StuffEnum, StuffRequest } from './services/test/stuff.contract';
import { ServiceRequestContext } from './services/serviceRequestContext';
import { TestHelper } from './testHelper';
import { ServiceResponseBase } from './services/serviceResponseBase';

let request: StuffRequest;
let response: ServiceResponseBase<Stuff<Date>[]>;
const executionContext: ServiceRequestContext = new ServiceRequestContext({ scope: 'private' });

beforeAll(async () => {
	await TestHelper.initClientServerScenario('http');

	request = new StuffRequest(
		{
			aBoolean: true,
			aDate: new Date(1600000000000),
			aString: 'hello',
			aStringArray: ['hello', 'world'],
			aNumber: 42,
			anEnum: StuffEnum.one,
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
			aGenericObject: new GenericStuff<Date>({
				theGeneric: new Date(1600000000005)
			}),
			aGenericObjectArray: [
				new GenericStuff<Date>({
					theGeneric: new Date(1600000000006)
				})
			]
		},
		{ token: '1234' });
});

afterAll(async () => {
	await TestHelper.shutdown();
});

describe('JsonToClassSerializer \n', function (): void {

	describe('execute with all types of properties set in the request \n', function (): void {
		beforeEach(async () => {
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
				expect(response[0].anEnum).toBe(StuffEnum.one);
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
			});
	});
});

