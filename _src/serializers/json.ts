import { NaniumSerializer } from '../interfaces/serializer';
import { NaniumObject } from '../objects';

export class NaniumJsonSerializer implements NaniumSerializer {

	deserialize(raw: string | ArrayBuffer): any {
		try {
			if (typeof raw === 'string') {
				return JSON.parse(raw);
			} else {
				return JSON.parse(new TextDecoder('utf-8').decode(raw));
			}
		} catch (e) {
			throw new Error('NaniumJsonSerializer: error while deserializing: "' + raw + '"');
		}
	}

	serialize(obj: any): string | ArrayBuffer {
		return JSON.stringify(obj);
	}

	deserializePartial(
		raw: string | ArrayBuffer,
		ctor: new (data?: any) => any,
		generics: { [id: string]: new() => any; },
		restFromLastTime?: string,
	): {
		data: any;
		rest: any;
	} {
		let txt: string;
		if (typeof raw === 'string') {
			txt = raw;
		} else {
			txt = new TextDecoder('utf-8').decode(raw);
		}
		if (restFromLastTime) {
			txt = restFromLastTime + txt;
		}

		let deserialized: any;
		let rest: any;
		const packets: string[] = txt.split(this.packageSeparator);
		const result: any[] = [];
		rest = packets.pop();
		for (const packet of packets) {
			deserialized = this.deserialize(packet);
			try {
				result.push(NaniumObject.plainToClass(deserialized, ctor, generics));
			} catch (e) {
				console.log(e);
			}
		}
		return { data: result, rest };
	}

	packageSeparator: string = '\0nanium\0';
	mimeType: string = 'application/json';
}
