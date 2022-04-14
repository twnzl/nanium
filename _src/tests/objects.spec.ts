import { NaniumObject, Type } from '../objects';

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

describe('nanium objects \n', function (): void {

	describe('initObject\n', function (): void {

		it('--> basics should work \n', async function (): Promise<void> {
			const obj: MyTestClass<number> = new MyTestClass({
				aNumber: 1,
				aString: '123',
				aDate: new Date(2000, 1, 1),
				sub1: {
					aBoolean: true,
					theGeneric: 1,
				},
				sub2: {
					theGeneric: new Date(2000, 1, 2)
				},
			}, { 'T': Number });
			expect(obj.aNumber).toBe(1);
			expect(obj.aString).toBe('123');
			expect(obj.aDate.toISOString()).toBe(new Date(2000, 1, 1).toISOString());
			expect(obj.sub1 instanceof MyTestClass, 'sub1 should be Instance of MyTestClass').toBe(true);
			expect(obj.sub1.theGeneric).toBe(1);
			expect(obj.sub2.theGeneric.toISOString()).toBe(new Date(2000, 1, 2).toISOString());
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
	});
});


