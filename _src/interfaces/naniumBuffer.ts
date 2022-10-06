export class NaniumBuffer {

	private internalValue: DataSource[] = [];

	constructor(data?: DataSource | DataSource[]) {
		if (data) {
			if (Array.isArray(data)) {
				for (const part of data) {
					this.write(part);
				}
			} else {
				this.write(data as DataSource);
			}
		}
	}

	get length(): number {
		return this.internalValue.map(part =>
			(part as any).length ??
			(part as ArrayBuffer).byteLength ??
			(part as Blob).size
		).reduce((whole, next) => whole + next);
	}

	// static from(data: ArrayBuffer | Buffer | Blob): NaniumBuffer {
	// 	const result: NaniumBuffer = new NaniumBuffer();
	// 	result.write(result);
	// 	return result;
	// }

	write(data: DataSource | NaniumBuffer) {
		if (data instanceof NaniumBuffer) {
			for (const part of data.internalValue) {
				this.internalValue.push(part);
			}
		} else {
			this.internalValue.push(data);
		}
		// if (typeof data['arrayBuffer'] === 'function') {
		// 	this.internalValue.push(data['arrayBuffer']() as ArrayBuffer);
		// } else if (data['buffer']) {
		// 	this.internalValue.push(data['buffer'] as ArrayBuffer);
		// } else {
		// 	this.internalValue.push(data as ArrayBuffer);
		// }
	}

	asUint8Array(): Uint8Array {
		const result = new Uint8Array(this.length);
		let tmp: Uint8Array;
		let i: number = 0;
		let j: number = 0;
		for (const part of this.internalValue) {
			if (typeof part['size'] === 'function') { // Blob
				for (i = 0; i < (part as Blob).size; ++i) {
					result[j + i] = part[i];
				}
			} else if (typeof part === 'string') { // String
				tmp = new TextEncoder().encode(part);
				for (i = 0; i < tmp.byteLength; ++i) {
					result[j + i] = tmp[i];
				}
			} else if (part['length']) { // Buffer
				for (i = 0; i < (part as Uint8Array).length; ++i) {
					result[j + i] = part[i];
				}
			} else { // ArrayBuffer
				for (i = 0; i < (part as ArrayBuffer).byteLength; ++i) {
					result[j + i] = part[i];
				}
			}
			j += i;
		}
		return result;
	}

	clear() {
		this.internalValue = [];
	}
}

export type DataSource = (ArrayBuffer | Uint8Array | Blob | string);
