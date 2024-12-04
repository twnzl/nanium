import { NaniumBuffer } from '../../../interfaces/naniumBuffer';
import { NaniumObject, NaniumPropertyInfoCore } from '../../../objects';
import { NaniumHttpChannelConfig } from './http';

export class MultipartParser {
	private static fieldValueStart = Buffer.from('\r\n\r\n');
	private static fieldValueEnd = Buffer.from('\r\n');
	private static quote = 34;
	private static space = 32;

	private state: 'searchingBoundary' | 'readingFieldHeader' | 'readingRequest' | 'readingBinary' = 'searchingBoundary';
	private boundary: Buffer;
	private requestBuf: NaniumBuffer;
	private currentBinary: NaniumBuffer;
	private nameStart: number;
	private fieldName: string;
	private dataPortions: Buffer[] = [];

	private tmp: NaniumBuffer = new NaniumBuffer();
	private binaries: { [id: string]: NaniumBuffer } = {};

	constructor(
		private contentType: string,
		private channelConfig: NaniumHttpChannelConfig,
		private serviceRepository: any,
	) {
		this.boundary = Buffer.from(new TextEncoder().encode(
			'--' + contentType.split('multipart/form-data; boundary=')[1]
		));
	}

	async parsePart(data: Buffer) {
		// this.dataPortions prevents parallel parsing of multiple data portions if e.g. the second portion arrives
		// and parsePart is called while the first call of parsePart is waiting of some async operation but is not yet ready
		this.dataPortions.push(data);
		if (this.dataPortions.length > 1) {
			return;
		}

		while (this.dataPortions.length > 0) {
			data = this.dataPortions[0];
			this.tmp.write(data);
			let buf: Buffer;
			let i = 0;
			let valueStart: number;
			if (this.state === 'searchingBoundary' && this.tmp.length < this.boundary.length) {
				return;
			}
			buf = await this.tmp.as(Buffer);
			while (i < buf.length) {
				if (this.state === 'searchingBoundary') {
					if (buf[i] === this.boundary[0] && Buffer.compare(this.boundary, buf.slice(i, i + this.boundary.length)) === 0) {
						i += this.boundary.length;
						this.state = 'readingFieldHeader';
						this.boundary = Buffer.concat([MultipartParser.fieldValueEnd, this.boundary]);
					} else {
						i++;
					}
				} else if (this.state === 'readingFieldHeader') {
					if (buf.slice(i, i + 4).compare(MultipartParser.fieldValueStart) === 0) {
						i += 4;
						if (this.fieldName === 'request') {
							this.requestBuf = new NaniumBuffer();
							this.state = this.state = 'readingRequest';
						} else {
							this.state = 'readingBinary';
							this.currentBinary = new NaniumBuffer();
							this.binaries[this.fieldName] = this.currentBinary;
						}
						this.fieldName = undefined;
					} else if (buf[i] === MultipartParser.space && buf.slice(i, i + 7).toString() === ' name="') { // name (names including " are currently nor allowed)
						this.nameStart = i + 7;
						i += 7;
					} else if (this.nameStart && buf[i] === MultipartParser.quote) { // end of name
						this.fieldName = buf.slice(this.nameStart, i).toString();
						this.nameStart = undefined;
						i++;
					} else {
						i++;
					}
				} else if (this.state === 'readingRequest' || this.state === 'readingBinary') {
					// noinspection JSUnusedAssignment
					valueStart = valueStart ?? i;
					if (buf[i] === this.boundary[0] && Buffer.compare(this.boundary, buf.slice(i, i + this.boundary.length)) === 0) { // next boundary
						if (this.state === 'readingRequest') {
							this.requestBuf.write(buf.slice(valueStart, i));
						} else {
							this.currentBinary.write(buf.slice(valueStart, i));
						}
						valueStart = undefined;
						i += this.boundary.length;
						this.state = 'readingFieldHeader';
					} else if (
						buf[i] === this.boundary[0] &&
						(i + this.boundary.length) > buf.length &&
						Buffer.compare(this.boundary.slice(0, buf.length - i), buf.slice(i, i + buf.length)) === 0
					) {
						// ends with something that looks like a boundary
						// keep the rest in tmp buffer, as prefix of next data portion and stop for current data portion
						if (this.state === 'readingRequest') {
							this.requestBuf.write(buf.slice(valueStart, i));
						} else {
							this.currentBinary.write(buf.slice(valueStart, i));
						}
						this.tmp = new NaniumBuffer(buf.slice(i));
						buf = undefined;
						break;
					} else {
						i++;
					}
				}
			}
			if (this.nameStart && buf) {
				this.tmp = new NaniumBuffer(buf.slice(this.nameStart));
			}
			if (this.state === 'readingRequest' && valueStart && buf) {
				this.requestBuf.write(buf.slice(valueStart));
				this.tmp = new NaniumBuffer();
			}
			if (this.state === 'readingBinary' && valueStart && buf) {
				this.currentBinary.write(buf.slice(valueStart));
				this.tmp = new NaniumBuffer();
			}
			this.dataPortions.shift(); // remove current data portion, when all of it is parsed, so that the next portions can start
		}
	}

	async getResult() {
		const txt = await this.requestBuf.asString();
		const deserialized = this.channelConfig.serializer.deserialize(txt);
		const request = NaniumObject.create(deserialized.request, this.serviceRepository[deserialized.serviceName].Request);
		NaniumObject.forEachProperty(request, (name: string[], parent?: Object, typeInfo?: NaniumPropertyInfoCore) => {
			if (
				(typeInfo?.ctor && typeInfo?.ctor['naniumBufferInternalValueSymbol']) ||
				(parent[name[name.length - 1]]?.constructor && parent[name[name.length - 1]]?.constructor['naniumBufferInternalValueSymbol'])
			) {
				parent[name[name.length - 1]].write(this.binaries[parent[name[name.length - 1]].id]);
			}
		});
		return [request, deserialized];
	}
}
