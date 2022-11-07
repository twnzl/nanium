import { NaniumObject, Type } from './objects';
import { Nanium } from './core';
import { TestLogger } from './tests/testLogger';
import { LogLevel } from './interfaces/logger';

class MyTestClass<T> extends NaniumObject<MyTestClass<T>> {
	@Type(Number) aNumber?: number;
	@Type(String) aString?: string;
	@Type(Boolean) aBoolean?: boolean;
	@Type(Date) aDate?: Date;
	@Type('T') theGeneric?: T;
	@Type(Array, Date) aDateArray?: Date[];
	@Type(MyTestClass) sub1?: MyTestClass<T>;
	@Type(MyTestClass, { 'T': Date }) sub2?: MyTestClass<Date>;
}

class MyTestClass2 extends NaniumObject<MyTestClass2> {
	@Type(Number) aNumber?: number;
	@Type(String) aString?: string;
	@Type(Boolean) aBoolean?: boolean;
	@Type(Date) aDate?: Date;
	@Type(Object) anObject?: any;
	@Type(Object, MyTestClass2) aDictionary?: { [key: string]: MyTestClass2 };
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
			}, { 'T': Number });
			expect(obj.aNumber).toBe(1);
			expect(obj.aString).toBe('123');
			expect(obj.aDate.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
			expect(obj.sub1 instanceof MyTestClass, 'sub1 should be Instance of MyTestClass').toBe(true);
			expect(obj.sub1.theGeneric).toBe(1);
			expect(obj.aDateArray[0].toISOString()).toBe(new Date(2000, 2, 3).toISOString());
			expect(obj.sub2.theGeneric.toISOString()).toBe(new Date(2000, 1, 2).toISOString());
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

		it('generic subtypes should work, when specified', async function (): Promise<void> {
			const created = NaniumObject.create(obj, MyTestClass, { 'T': MyTestClass2 }, true);
			expect(created.theGeneric instanceof MyTestClass2, 'theGeneric should have the type MyTestClass2').toBeTruthy();
			expect(created.theGeneric.aDate.toISOString(), 'sub properties of theGeneric should have the right types and values').toBe(obj.theGeneric.aDate.toISOString());
			expect(created.theGeneric.aNumber, 'sub properties of theGeneric should have the right types an values').toBe(42);
		});
	});
});

