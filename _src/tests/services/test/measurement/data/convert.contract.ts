import { NaniumObject, RequestType, Type } from '../../../../../objects';
import { NaniumStream } from '../../../../../interfaces/naniumStream';
import { NaniumBuffer } from '../../../../../interfaces/naniumBuffer';
import { SimpleServiceRequestBase } from '../../../simpleServiceRequestBase';

export class TestMeasurementDataConvertRequestBody extends NaniumObject<TestMeasurementDataConvertRequestBody> {
	@Type(String) measurementId: string;
	@Type(NaniumStream, { 'T': NaniumBuffer }) video?: NaniumStream<NaniumBuffer>;
	@Type(NaniumStream, { 'T': Number }) values?: NaniumStream<number>;
}

export class TestMeasurementDataConvertResponse extends NaniumObject<TestMeasurementDataConvertResponse> {
	@Type(String) measurementId: string;
	@Type(String) videoFileId: string;
	@Type(NaniumStream, { 'T': NaniumBuffer }) convertedVideo: NaniumStream<NaniumBuffer>;
	@Type(NaniumStream, { 'T': Number }) convertedValues: NaniumStream<number>;

}


@RequestType({
	responseType: TestMeasurementDataConvertResponse,
	genericTypes: { TRequestBody: TestMeasurementDataConvertRequestBody },
	scope: 'public'
})
export class TestMeasurementDataConvertRequest extends SimpleServiceRequestBase<TestMeasurementDataConvertRequestBody, TestMeasurementDataConvertResponse> {
	static serviceName: string = 'NaniumTest:test/measurement/data/convert';
}
