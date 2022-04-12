import { NaniumSerializer } from '../interfaces/serializer';
import { NaniumSerializerCore } from './core';

export class NaniumJsonSerializer implements NaniumSerializer {

	async deserialize(str: string): Promise<any> {
		try {
			return JSON.parse(str);
		} catch (e) {
			throw new Error('NaniumJsonSerializer: error while deserializing: "' + str + '"');
		}
	}

	async serialize(obj: any): Promise<string> {
		return JSON.stringify(obj);
	}

	async getData(
		rawData: any,
		ctor: new (data?: any) => any,
		generics: { [id: string]: new() => any; }
	): Promise<{
		data: any;
		rest: any;
	}> {
		let deserialized: any;
		let rest: any;
		const packets: string[] = rawData.split(this.packageSeparator);
		const result: any[] = [];
		rest = packets.pop();
		for (const packet of packets) {
			deserialized = await this.deserialize(packet);
			result.push(NaniumSerializerCore.plainToClass(deserialized, ctor, generics));
		}
		return { data: result, rest };
	}

	packageSeparator: string = '\0nanium\0';
	mimeType: string = 'application/json';
}
