# 1.19.3

- Consumer request interceptor behaviour changed. If the interceptor returns undefined or the same request instance,
  execution will continue, but if something different is returned it is treated as the response for the request.
- added possibility to define response interceptors for NaniumConsumerBrowserHttp. If the interceptor returns something
  different from undefined or the original response instance, the returned value will replace the original response.
- no warnings for dictionary properties. If a property is marked with @Type(Object, SomeType), it means that the object
  can have any properties but all must be of type SomeType. This is a typical dictionary and now nanium will no longer
  display warnings about unknown properties for the keys of such Dictionaries.

## breaking changes

The change of the request interceptor behaviour may be a breaking change if any of your interceptores returns something
different from undefined or the request instance. But this should normally not be the case, because until now the return
value of an interceptor had no effect.

# 1.19.2

- fix problem with NaniumBuffers in obfuscated code

# 1.19.1

- make parsing of requests with NaniumBuffers save in case next portion of data from consumer arrives before the last
  portion has been parsed.
- fix handling of requests with NaniumBuffers, in case buffer properties are undefined

# 1.19.0

- class NaniumBuffer
    - works on both nodejs and browser and can work with all Buffer formats from both worlds
    - you can write multiple times to the buffer and do not need to specify a size first. Data written to the buffer is
      not copied internally when calling write but may be (if necessary) when calling one of the as...() functions (e.g.
      asArrayBuffer()).
    - can be used as Type for properties in requests to send big data together with other data but without serializing
      it (e.g. for uploading files as binaries).
- fixed naming of response type of generated contracts

## breaking changes

- The request-contract of services that use ArrayBuffers as ResponseType, must now use NaniumBuffer as
  ResponseType. The executers may stay as they are - the 'execute' or 'stream' function is allowed to return any kind of
  buffer (NaniumBuffer | ArrayBuffer | BlobLike | string | Uint8Array | other typed arrays Float32Array etc.) only the
  request must be changed. At the caller the result will always be of type NaniumBuffer and can so easily be converted
  to any other kind of Buffer using the as function e.g.: result.as(Blob).

```ts
// the contract
@RequestType({
	responseType: NaniumBuffer,
	scope: 'public'
})
export class TestGetStreamedArrayBufferRequest extends ServiceRequestBase<void, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getStreamedArrayBuffer';
}

export class TestGetStreamedArrayBufferExecutor implements StreamServiceExecutor<TestGetStreamedArrayBufferRequest, ArrayBuffer> {
	static serviceName: string = 'NaniumTest:test/getStreamedArrayBuffer';

	stream(request: TestGetStreamedArrayBufferRequest, executionContext: ServiceRequestContext): Observable<ArrayBuffer> {
		return new Observable((observer: Observer<ArrayBuffer>): void => {
			const enc: TextEncoder = new TextEncoder();
			const buf: ArrayBuffer = enc.encode('This is a string converted to a Uint8Array');
			observer.next(buf.slice(0, 4));
			setTimeout(() => observer.next(buf.slice(4, 20)), 500);
			setTimeout(() => observer.next(buf.slice(20, buf.byteLength)), 1000);
			setTimeout(() => observer.complete(), 1500);
		});
	}
}

```

# 1.18.3

- prevent restart waiting for events, when Http-Consumer has been terminated

# 1.18.2

- cleanup of NaniumObject function signatures
- NaniumObject fix: strict option had been ignored for sub objects
- new global default value for strict option (NaniumObject.strictDefault)

## breaking changes

- removed NaniumObject.plainToClass NaniumObject.initObjectCore. Use NaniumObject.Create and NaniumObject.Init instead.

# 1.18.1

- more general type definitions for interceptors

## breaking changes

- added parameter *genericTypes* to *NaniumObject.create*

# 1.18.0

- added basic implementation of NaniumProviderBrowser. This enables you to implement and use services and events within
  the scope of a web client. There are no channels and no api calls behind service executions, but you can structure
  your client logic in services too and can use global events. This is also useful for client tests because you can
  easily replace server calls by client side service implementations
- fix: binary data have not been transferred correctly if the executer does not return UInt8Array

## breaking changes

- the isResponsible functions no longer return 'yes' or 'no' or fallback but a number that represents priority.
  change
    - 'no' to 0
    - 'yes' to 2
    - 'fallback' to 1

# 1.17.0

- added binary responses and binary streaming. Services that return ArrayBuffers as result in the execute or stream
  function will skip the interceptor and pass data just binary data to the caller.

# ...
