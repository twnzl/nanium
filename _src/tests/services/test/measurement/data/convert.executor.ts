import { TestMeasurementDataConvertRequest, TestMeasurementDataConvertResponse } from './convert.contract';
import { ServiceExecutor } from '../../../../../interfaces/serviceExecutor';
import { NaniumBuffer } from '../../../../../interfaces/naniumBuffer';
import { NaniumStream } from '../../../../../interfaces/naniumStream';
import { ExecutionContext } from '../../../../../interfaces/executionContext';

export class TestMeasurementDataConvertExecutor implements ServiceExecutor<TestMeasurementDataConvertRequest, TestMeasurementDataConvertResponse> {
	static serviceName: string = 'NaniumTest:test/measurement/data/convert';

	async execute(request: TestMeasurementDataConvertRequest, executionContext: ExecutionContext): Promise<TestMeasurementDataConvertResponse> {
		const id = request.body.measurementId;
		const response = new TestMeasurementDataConvertResponse({
			measurementId: id + '*',
			// convertedValues: request.body.values ? new NaniumStream<number>() : undefined,
			convertedVideo: new NaniumStream<NaniumBuffer>(),
		});
		// request.body.values?.subscribe({
		// 	next: (val: number) => {
		// 		console.log('values.next. ' + val);
		// 		response.convertedValues.next(val * 2);
		// 	},
		// 	complete: () => {
		// 		response.convertedValues.complete();
		// 	}
		// });
		request.body.video.subscribe({
			next: async (val: NaniumBuffer) => {
				const text = new TextDecoder().decode(await val.asUint8Array());
				const result: string[] = [];
				for (let i = 0; i < text.length; i++) {
					result.push((parseInt(text[i]) + 1).toString());
				}
				response.convertedVideo.next(new NaniumBuffer(new TextEncoder().encode(result.join(''))));
			},
			complete: () => {
				response.convertedVideo.complete();
			}
		});
		return response;
	}
}
