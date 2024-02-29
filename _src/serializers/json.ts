import { NaniumSerializer } from '../interfaces/serializer';

export class NaniumJsonSerializer implements NaniumSerializer {

	constructor(
		public packageSeparator: string = '\0nanium\0',
		public mimeType: string = 'application/json',
	) {
	}

	deserialize(raw: string | ArrayBuffer): any {
		try {
			if (typeof raw === 'string') {
				return raw ? JSON.parse(raw) : undefined;
			} else {
				return (raw as ArrayBuffer)?.byteLength ? JSON.parse(new TextDecoder('utf-8').decode(raw)) : undefined;
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
			result.push(deserialized);
		}
		return { data: result, rest };
	}
}
