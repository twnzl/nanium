import { AnySimple, JSONSchema, NaniumObject, NaniumPropertyInfoCore, Type } from './objects';
import { Nanium } from './core';
import { TestLogger } from './tests/testLogger';
import { LogLevel } from './interfaces/logger';
import { TestGetRequest, TestGetRequestBody, TestGetResponseBody } from './tests/services/test/get.contract';
import { ServiceResponseBase } from './tests/services/serviceResponseBase';

class MyTestClass2 extends NaniumObject<MyTestClass2> {
	@Type(Number) aNumber?: number;
	@Type(String) aString?: string;
	@Type(Boolean) aBoolean?: boolean;
	@Type(Date) aDate?: Date;
	@Type(Object) anObject?: any;
	@Type(Object, MyTestClass2) aDictionary?: { [key: string]: MyTestClass2 };
	@Type(MyTestClass2) next: MyTestClass2;
	something?: string;
}

class MyTestClass<T> extends NaniumObject<MyTestClass<T>> {
	@Type(Number) aNumber?: number;
	@Type(String) aString?: string;
	@Type(Boolean) aBoolean?: boolean;
	@Type(Date) aDate?: Date;
	@Type('T') theGeneric?: T;
	@Type(Array, Date) aDateArray?: Date[];
	@Type(MyTestClass) sub1?: MyTestClass<T>;
	@Type(MyTestClass, { 'T': Date }) sub2?: MyTestClass<Date>;
	@Type(Object) anyObject?: Object;
	@Type(Object, MyTestClass2) dict?: MyTestClass2;
	@Type(Array, MyTestClass2) anObjectArray?: MyTestClass2;
	@Type(Array, AnySimple) anySimpleArray?: (string | number)[];
}

class S {
	@Type(String) type: string;
	@Type(String) value: string;
}

class D {
	@Type(String) type: string;
	@Type(Date) value: Date;
}


class MyTestClass3<TConfig> extends NaniumObject<MyTestClass3<TConfig>> {
	@Type(Number) no?: number;
	@Type(String) str?: string;
	@Type(Object, (me, p: any, pp: MyTestClass3<String | Date>) => pp.str === 's' ? String : Date)
	dict?: { [key: string]: String | Date };
	@Type(Array, (me: S | D) => me.type === 's' ? S : D)
	arr?: (S | D)[];
	@Type((me, p: MyTestClass3<any>) => p.str === 's' ? String : Date)
	aGeneric?: TConfig;
	@Type(MyTestClass, { 'T': (me, p: MyTestClass<String | Date>) => p.aString === 's' ? String : Date })
	aSubGeneric?: MyTestClass<String | Date>;
}

class MyTestClass4 extends NaniumObject<MyTestClass4> {
	@Type(Array, Object) jsonSchemas?: JSONSchema[];
	@Type(Object, MyTestClass4) dic?: { [key: string]: MyTestClass4 };
}

describe('nanium objects', function (): void {

	describe('constructor', function (): void {

		it('--> basics should work \n', async function (): Promise<void> {
			const obj: MyTestClass<number> = new MyTestClass({
				aNumber: 1,
				aString: '123',
				aDate: new Date(2000, 1, 1),
				sub1: {
					aBoolean: true,
					theGeneric: 1,
				},
				aDateArray: [new Date(2000, 2, 3)],
				sub2: {
					theGeneric: new Date(2000, 1, 2)
				},
				anySimpleArray: [1, '2']
			}, { 'T': Number });
			expect(obj.aNumber).toBe(1);
			expect(obj.aString).toBe('123');
			expect(obj.aDate.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
			expect(obj.sub1 instanceof MyTestClass, 'sub1 should be Instance of MyTestClass').toBe(true);
			expect(obj.sub1.theGeneric).toBe(1);
			expect(obj.aDateArray[0].toISOString()).toBe(new Date(2000, 2, 3).toISOString());
			expect(obj.sub2.theGeneric.toISOString()).toBe(new Date(2000, 1, 2).toISOString());
			expect(obj.anySimpleArray[0]).toBe(1);
			expect(obj.anySimpleArray[1]).toBe('2');
		});

		it('--> array property is undefined or null \n', async function (): Promise<void> {
			let obj: MyTestClass<number> = new MyTestClass({ aDateArray: undefined }, { 'T': Number });
			expect(obj.aDateArray).toBeUndefined();
			obj = new MyTestClass({ aDateArray: null }, { 'T': Number });
			expect(obj.aDateArray).toBeNull();
		});

		it('--> parsing should work \n', async function (): Promise<void> {
			const src: any = {
				aDate: new Date(2000, 1, 1).toISOString(),
				aNumber: '123',
				aBoolean: false,
				sub1: {
					theGeneric: '1',
					aBoolean: 'false',
				},
			};
			const obj: MyTestClass<number> = new MyTestClass(src);
			expect(obj.aDate.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
			expect(obj.aNumber).toBe(123);
			expect(obj.aBoolean).toBe(false);
			expect(obj.sub1.theGeneric).toBe('1'); // parsing does not work if generic info is not passed to the constructor
			expect(obj.sub1.aBoolean).toBe(false);
		});

		it('--> parsing for global generics should work if generic info is not passed to the constructor \n', async function (): Promise<void> {
			const src: any = {
				sub1: {
					theGeneric: '1',
				},
			};
			const obj: MyTestClass<number> = new MyTestClass(src, { 'T': Number });
			expect(obj.sub1.theGeneric).toBe(1);
		});

		it('--> not defined properties should be skipped if strict=true \n', async function (): Promise<void> {
			const src: any = {
				aString: 'a',
				aStranger: '*'
			};
			const obj: MyTestClass<number> = new MyTestClass(src, undefined, true);
			expect(obj.aString).toBe('a');
			expect(obj['aStranger']).toBeUndefined();
			expect(Object.keys(obj).length).toBe(1);
		});

		it('--> properties of type Object and typed Dictionaries \n', async function (): Promise<void> {
			const obj: MyTestClass2 = new MyTestClass2({
				aNumber: 1,
				anObject: { a: { aa: 1 } },
				aDictionary: { b: { aNumber: 1, anyProp: 2 } } as any
			}, undefined, true);
			expect(obj.aNumber).toBe(1);
			expect(obj.anObject.a.aa).toBe(1);
			expect(obj.aDictionary.b.aNumber).toBe(1);
			expect(obj.aDictionary.b['anyProp']).toBeUndefined();
		});

		it('via constructor created object must be a deep clone', async function (): Promise<void> {
			const obj: MyTestClass<number> = new MyTestClass({
				aNumber: 1,
				aString: '123',
				aDate: new Date(2000, 1, 1),
				sub1: {
					aBoolean: true,
					theGeneric: 1,
				},
				aDateArray: [new Date(2000, 2, 3)],
				sub2: {
					theGeneric: new Date(2000, 1, 2)
				},
				anyObject: {
					str: ':-)',
					arr: [],
					date: new Date(),
					obj: {}
				}
			}, { 'T': Number });
			const result = new MyTestClass(obj);
			expect(result.sub1 === obj.sub1).toBe(false);
			expect(result.aDate === obj.aDate).toBe(false);
			expect(result.aDateArray === obj.aDateArray).toBe(false);
			expect(result.anyObject === obj.anyObject).toBe(false);
			expect((result.anyObject as any).str === (obj.anyObject as any).str).toBe(true);
			expect((result.anyObject as any).arr === (obj.anyObject as any).arr).toBe(false);
			expect((result.anyObject as any).date === (obj.anyObject as any).date).toBe(false);
			expect((result.anyObject as any).obj === (obj.anyObject as any).obj).toBe(false);
		});
	});

	describe('create', function (): void {
		let obj: MyTestClass<MyTestClass2>;
		let testLogger = new TestLogger(LogLevel.info);

		beforeEach(() => {
			Nanium.logger = testLogger;
			obj = new MyTestClass();
			obj.aBoolean = true;
			obj.theGeneric = new MyTestClass2();
			obj.theGeneric.aDate = new Date(2022, 8, 19);
			obj.theGeneric.aNumber = 42;
		});

		it('strict = true', async function (): Promise<void> {
			obj['unknownProp'] = ':-)';
			obj.theGeneric['unknownProp2'] = ':-o';
			const created = NaniumObject.create<MyTestClass<MyTestClass2>>(obj, MyTestClass, { 'T': MyTestClass2 }, true);
			expect(created['unknownProp'], 'unknown property from source should not be at the result object').toBeUndefined();
			expect(created.theGeneric['unknownProp2'], 'unknown property from sources sub object should not be at the result object').toBeUndefined();
		});

		it('strict = false ', async function (): Promise<void> {
			obj['unknownProp'] = ':-)';
			obj.theGeneric['unknownProp2'] = { answer: 42 };
			const created = NaniumObject.create<MyTestClass<MyTestClass2>>(obj, MyTestClass, { 'T': MyTestClass2 }, false);
			expect(created['unknownProp'], 'unknown property from source should be at the result object with type and value of source').toBe(':-)');
			expect(created.theGeneric['unknownProp2'].answer, 'unknown property from sources sub object should be at the result object with type and value of source').toBe(42);
			expect(testLogger.warnings.length, 'in loose mode - warnings should have logged regarding unknown properties').toBe(2);
			expect(testLogger.warnings[0][0].includes('unknownProp2'), 'in loose mode - warnings should have logged regarding unknown properties').toBeTruthy();
			expect(testLogger.warnings[1][0].includes('unknownProp'), 'in loose mode - warnings should have logged regarding unknown properties').toBeTruthy();
		});

		it('deepClone = true', async function (): Promise<void> {
			const obj: MyTestClass<number> = new MyTestClass({
				aNumber: 1,
				aString: '123',
				aDate: new Date(2000, 1, 1),
				sub1: {
					aBoolean: true,
					theGeneric: 1,
				},
				aDateArray: [new Date(2000, 2, 3)],
				sub2: {
					theGeneric: new Date(2000, 1, 2)
				},
				anyObject: {
					str: ':-)',
					arr: [],
					date: new Date(),
					obj: {}
				}
			}, { 'T': Number });
			const result = NaniumObject.create(obj, MyTestClass, { 'T': Number }, true, true);
			expect(result.sub1 === obj.sub1).toBe(false);
			expect(result.aDate === obj.aDate).toBe(false);
			expect(result.aDateArray === obj.aDateArray).toBe(false);
			expect(result.anyObject === obj.anyObject).toBe(false);
			expect((result.anyObject as any).str === (obj.anyObject as any).str).toBe(true);
			expect((result.anyObject as any).arr === (obj.anyObject as any).arr).toBe(false);
			expect((result.anyObject as any).date === (obj.anyObject as any).date).toBe(false);
			expect((result.anyObject as any).obj === (obj.anyObject as any).obj).toBe(false);
		});

		it('deepClone = false', async function (): Promise<void> {
			const obj: MyTestClass<number> = new MyTestClass({
				aNumber: 1,
				aString: '123',
				aDate: new Date(2000, 1, 1),
				sub1: {
					aBoolean: true,
					theGeneric: 1,
				},
				aDateArray: [new Date(2000, 2, 3)],
				sub2: {
					theGeneric: new Date(2000, 1, 2)
				},
				anyObject: {
					str: ':-)',
					arr: [],
					date: new Date(),
					obj: {}
				}
			}, { 'T': Number });
			const result = NaniumObject.create(obj, MyTestClass, { 'T': Number }, true, false);
			expect(result.sub1 === obj.sub1).toBe(false);
			expect(result.aDate === obj.aDate).toBe(false);
			expect(result.aDateArray === obj.aDateArray).toBe(false);
			expect(result.anyObject === obj.anyObject).toBe(true);
			expect((result.anyObject as any).str === (obj.anyObject as any).str).toBe(true);
			expect((result.anyObject as any).arr === (obj.anyObject as any).arr).toBe(true);
			expect((result.anyObject as any).date === (obj.anyObject as any).date).toBe(true);
			expect((result.anyObject as any).obj === (obj.anyObject as any).obj).toBe(true);
		});

		it('generic subtypes should work, when specified', async function (): Promise<void> {
			const created = NaniumObject.create(obj, MyTestClass, { 'T': MyTestClass2 }, true);
			expect(created.theGeneric instanceof MyTestClass2, 'theGeneric should have the type MyTestClass2').toBeTruthy();
			expect(created.theGeneric.aDate.toISOString(), 'sub properties of theGeneric should have the right types and values').toBe(obj.theGeneric.aDate.toISOString());
			expect(created.theGeneric.aNumber, 'sub properties of theGeneric should have the right types an values').toBe(42);
		});

		it('determining generic Type via arrow function', async function (): Promise<void> {
			let result = NaniumObject.create<MyTestClass3<any>>({
				str: 's',
				aGeneric: '2023-01-01T00:00:00.000Z',
				dict: { from: '2023-01-01T00:00:00.888Z', to: '2023-01-01T00:00:00.999Z' },
				aSubGeneric: { aString: 's', theGeneric: '2023-03-02T20:00:58.637Z' }
			}, MyTestClass3, { 'T': Number }, true, false);
			expect(result instanceof MyTestClass3).toBe(true);
			expect(result.dict.from).toBe('2023-01-01T00:00:00.888Z');
			expect(result.dict.to).toBe('2023-01-01T00:00:00.999Z');
			expect(result.aGeneric).toBe('2023-01-01T00:00:00.000Z');
			expect(result.aSubGeneric instanceof MyTestClass).toBe(true);
			expect(typeof result.aSubGeneric.theGeneric === 'string').toBe(true);

			result = NaniumObject.create<MyTestClass3<any>>({
				str: 'd',
				dict: { from: '2023-01-01T00:00:00.888Z', to: '2023-01-01T00:00:00.999Z' },
				arr: [{ type: 's', value: '***' }, { type: 'd', value: '2023-01-01T00:00:00.999Z' }],
				aGeneric: '2023-01-01T00:00:00.000Z',
				aSubGeneric: { aString: 'd', theGeneric: '2023-03-02T20:00:58.637Z' }
			}, MyTestClass3, { 'T': Number }, true, false);
			expect(result instanceof MyTestClass3).toBe(true);
			expect((result.dict.from as Date).toISOString()).toBe('2023-01-01T00:00:00.888Z');
			expect((result.dict.to as Date).toISOString()).toBe('2023-01-01T00:00:00.999Z');
			expect(result.arr.length).toBe(2);
			expect(result.arr[0].value).toBe('***');
			expect((result.arr[1] as D).value.toISOString()).toBe('2023-01-01T00:00:00.999Z');
			expect((result.aGeneric as Date).toISOString()).toBe('2023-01-01T00:00:00.000Z');
			expect(result.aSubGeneric instanceof MyTestClass).toBe(true);
			expect(result.aSubGeneric.theGeneric instanceof Date).toBe(true);
			expect((result.aSubGeneric.theGeneric as Date).toISOString()).toBe('2023-03-02T20:00:58.637Z');
		});
	});

	describe('isConstructor', function (): void {
		it('works', async function (): Promise<void> {
			expect(NaniumObject['isConstructor'](MyTestClass)).toBe(true);
			expect(NaniumObject['isConstructor'](() => MyTestClass)).toBe(false);
		});
	});

	describe('isPropertyDefined', function (): void {
		it('isPropertyDefined: yes', async function (): Promise<void> {
			expect(NaniumObject.isPropertyDefined(MyTestClass, 'aNumber')).toBe(true);
		});

		it('isPropertyDefined: not defined', async function (): Promise<void> {
			expect(NaniumObject.isPropertyDefined(MyTestClass, 'nothing')).toBe(false);
		});

		it('isPropertyDefined: defined but without @Type() modifier', async function (): Promise<void> {
			expect(NaniumObject.isPropertyDefined(MyTestClass, 'something')).toBe(false);
		});
	});

	describe('createJsonSchema', function (): void {
		const expected: JSONSchema[] = [
			{
				'fileMatch': ['*'],
				'uri': 'https://syscore.io/MyTestClass3.schema.json',
				'schema': {
					'type': 'object',
					'properties': {
						'no': {
							'type': 'number'
						},
						'str': {
							'type': 'string'
						},
						'dict': {
							'type': 'object'
						},
						'arr': {
							'type': 'array'
						},
						'aGeneric': {},
						'aSubGeneric': {
							'$ref': 'https://syscore.io/MyTestClass.schema.json'
						}
					}
				}
			},
			{
				'uri': 'https://syscore.io/MyTestClass.schema.json',
				'schema': {
					'type': 'object',
					'properties': {
						'aNumber': {
							'type': 'number'
						},
						'aString': {
							'type': 'string'
						},
						'aBoolean': {
							'type': 'boolean'
						},
						'aDate': {
							'type': 'date'
						},
						'theGeneric': {},
						'aDateArray': {
							'type': 'array',
							'items': {
								'type': 'date'
							}
						},
						'sub1': {
							'$ref': 'https://syscore.io/MyTestClass.schema.json'
						},
						'sub2': {
							'$ref': 'https://syscore.io/MyTestClass.schema.json'
						},
						'anyObject': {
							'type': 'object'
						},
						'dict': {
							'type': 'object',
							'patternProperties': {
								'^.*$': {
									'type': 'object',
									'$ref': 'https://syscore.io/MyTestClass2.schema.json'
								}
							}
						},
						'anObjectArray': {
							'type': 'array',
							'items': {
								'$ref': 'https://syscore.io/MyTestClass2.schema.json'
							}
						},
						'anySimpleArray': {
							'type': 'array',
							'items': {
								'type': ['number', 'string', 'boolean']
							}
						}
					}
				}
			},
			{
				'uri': 'https://syscore.io/MyTestClass2.schema.json',
				'schema': {
					'type': 'object',
					'properties': {
						'aNumber': {
							'type': 'number'
						},
						'aString': {
							'type': 'string'
						},
						'aBoolean': {
							'type': 'boolean'
						},
						'aDate': {
							'type': 'date'
						},
						'anObject': {
							'type': 'object'
						},
						'aDictionary': {
							'type': 'object',
							'patternProperties': {
								'^.*$': {
									'type': 'object',
									'$ref': 'https://syscore.io/MyTestClass2.schema.json'
								}
							}
						},
						'next': {
							'$ref': 'https://syscore.io/MyTestClass2.schema.json'
						}
					}
				}
			}
		];

		it('MyTestClass3 with no types already known', async function (): Promise<void> {
			const schema: any = NaniumObject.createJsonSchemas(MyTestClass3, 'https://syscore.io/', undefined, ['*']);
			expect(schema).toEqual(expected);
		});

		it('MyTestClass3 with one type already known', async function (): Promise<void> {
			const schema: any = NaniumObject.createJsonSchemas(MyTestClass3, 'https://syscore.io/', [expected[2]], ['*']);
			expect(schema).toEqual(expected);
		});

		it('MyTestClass3 with all types already known', async function (): Promise<void> {
			const schema: any = NaniumObject.createJsonSchemas(MyTestClass3, 'https://syscore.io/', expected, ['*']);
			expect(schema).toEqual(expected);
		});

		it('MyTestClass4: JSON schema of JSONSchema - infinit recursive', async function (): Promise<void> {
			const expected4 = [
				{
					'uri': 'https://syscore.io/MyTestClass4.schema.json',
					'schema': {
						'type': 'object',
						'properties': {
							'jsonSchemas': {
								'type': 'array',
								'items': {
									'type': 'object'
								}
							},
							'dic': {
								'type': 'object',
								'patternProperties': {
									'^.*$': {
										'type': 'object',
										'$ref': 'https://syscore.io/MyTestClass4.schema.json',
									}
								}
							},
						}
					}
				}
			];
			const result = NaniumObject.createJsonSchemas(MyTestClass4, 'https://syscore.io/', []);
			expect(result).toEqual(expected4);
		});

		it('TestGetRequest: body is of global generic type', async function (): Promise<void> {
			const expected = [
				{
					'uri': 'https://syscore.io/TestGetRequest.schema.json',
					'schema': {
						'type': 'object',
						'properties': {
							'head': {
								'$ref': 'https://syscore.io/ServiceRequestHead.schema.json'
							},
							'body': {
								'$ref': 'https://syscore.io/TestGetRequestBody.schema.json'
							}
						}
					}
				},
				{
					'uri': 'https://syscore.io/ServiceRequestHead.schema.json',
					'schema': {
						'type': 'object',
						'properties': {
							'token': {
								'type': 'string'
							},
							'language': {
								'type': 'string'
							}
						}
					}
				},
				{
					'uri': 'https://syscore.io/TestGetRequestBody.schema.json',
					'schema': {
						'type': 'object',
						'properties': {
							'cnt': {
								'type': 'number'
							}
						}
					}
				}
			];
			const result = NaniumObject.createJsonSchemas(TestGetRequest, 'https://syscore.io/', []);
			expect(result).toEqual(expected);
		});
	});

	describe('traverseType', function (): void {
		it('basics', async function (): Promise<void> {
			const result: string[] = [];
			NaniumObject.traverseType(MyTestClass2, (name: string[], info: NaniumPropertyInfoCore) => {
				result.push(name.join('.') + ' -> ' + info.ctor?.name);
			});
			expect(result).toEqual([
				'aNumber -> Number',
				'aString -> String',
				'aBoolean -> Boolean',
				'aDate -> Date',
				'anObject -> Object',
				'aDictionary -> Object',
				'next -> MyTestClass2',
				'next.aNumber -> Number',
				'next.aString -> String',
				'next.aBoolean -> Boolean',
				'next.aDate -> Date',
				'next.anObject -> Object',
				'next.aDictionary -> Object',
				'next.next -> MyTestClass2',
			]);
		});
	});

	describe('getRequestInfo', function (): void {
		test('TestGetRequest', async function (): Promise<void> {
			const result = NaniumObject.getRequestInfo(TestGetRequest);
			expect(result).toEqual({
				responseType: ServiceResponseBase,
				genericTypes: {
					TRequestBody: TestGetRequestBody,
					TResponseBody: TestGetResponseBody
				},
				scope: 'public'
			});
		});
	});
});


