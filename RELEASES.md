# 2.0.0

- Websocket browser consumer (for events only)
- Websocket channel (for events only)
- Channel instances must have an id now
- ClusterCommunicator takes functions for serializing and deserializing ExecutionContext
- Communicators only care for 'event_emit'. all other events must be handled by the managers and channels because only
  they know what is needed. (e.g. http channel inform all workers about subscriptions,
  but websocket channel does not need this )
- optimized types in EventBase - typescript knows the type of the event in the handler function of subscribe()
- removed old streaming meachanism

# 1.25.1

- include *contractparts.ts into sdk
 
# 1.25.0

- It is now also possible to use the event name instead of the constructor for event subscriptions via Nanium.subscribe.
  This should be used carefully, because subscriptions via event name do not support the conversion of event objects to
  its real type. The event object passed to the handler will just be what the serializer produces.
- event constructor type is defined more precise.

# 1.24.4

- createJsonSchemas: add optional parameter fileMatch '*'. Will be set at the main schema
- createJsonSchemas: better way to define dictionary properties (object with any properties but defined values)

# 1.24.3

- browser provider now ensures that request has correct type e.g. if passed as a common object to Nanium.execute().

# 1.24.2

- fixing broken detektion of NaniumStream instances and constructors, in minified code by the new function
  NaniumStream.isNaniumStream()

# 1.24.1

- ServiceRequestQueue.getExecutionContext gets the queue as the second parameter now. This may also help to determine
  the executionContext for an entry

# 1.24.0

- streamed responses are now possible with normal RequestBase. Instead of an separate stream() function the execute
  function should return an instance of NaniumStream. The consumer side can use the onData/onEnd/onError functions to
  register handler functions for these events. Alternatively the consumer can also use the toPromise() function to await
  the whole result as one Object-Array (object stream) or NaniumBuffer (binary stream).
- when using the old way of streaming via the separate stream function a deprecation warning will be printed. The old
  functionality will be removed soon.
- the cli command "nanium gs" will no longer work but print a deprecation hint

# 1.23.3

- added class AnySimple: to allow any simple type in function @Type()

# 1.23.2

- json schema interface: fileMatch
- json schema: fix infinit recursion of @Type(.., Object)

# 1.23.1

- make NaniumBuffer work correct for derived Types like File

# 1.23.0

- new function NaniumObject.createJsonSchemas: just a basic version that creates JSON schemas for a simple nanium
  object (annotated type)

# 1.22.0

- events are now also working in environments that use the cluster module to work with multiple processes.

# 1.21.1

- Using globalThis when whether global nor window are available. E.e. in web workers.

# 1.21.0

- NaniumObject: init and create have a new optional parameter "deepClone" to specify if objects with unknown type (e.g.
  @Type(Object)) should be copied to the target object as is (deepClone = false) or as a deep clone. For Properties with
  known type the property of the target object will always be created via the constructor of this type (= new object)
- NaniumObject: the constructor creates per default a deep clone
- NaniumObject: the @Type Decorator now also accepts an arrow function as first parameter, that takes the parent source
  Object and must return a Constructor for this property.
  ```ts  
  class MyClass<T extends A | B> extends NaniumObject<MyClass<any>> { 
    @Type(String) type: 'a' | 'b';
    @Type((p: MyClass<any>) => a.type === 'a' ? A : B) config: T;
  };
  const c = new MyClass({ 
    type: 'b',
    config: { bb: 3 }}
  ); 
  // c.config will have type B
  ```
- NaniumObject: the @Type Decorator now also accepts this type of arrow functions in the second parameter. Either direct
  or as value of a generic typeId
  ```ts
  class Wrapper extends NaniumObject<Wrapper> { 	
    @Type(MyClass, p => a.type === 'a' ? A : B) mc: MyClass<A | B>;
  };
  const c = new MyClass({     
    mc: {
      type: 'b',
      config: { bb: 3}
    }
  }); 
  // c.mc.config will have type B
  ```
- Events: static unsubscribe of EventClass is now callable without parameter and will unsubscribe alls subscriptions of
  this event type. Note! the EventBase class has changed and generated Events no longer need the subscribe function -
  the one of the base is enough.

# 1.20.1

- browserHttp: executionContext for request interceptors

# 1.20.0

- added interface NaniumCommunicator and ClusterCommunicator as the default way for communication between multiple
  processes via cluster module. With this, events also work in multi-process environments that use the nodejs:cluster
  module.
- event subscription of providers now remember the execution context when they have been subscribed. This information
  can be used e.g. in SendEventEmission interceptors to decide if an event ist emitted to a specific subscriber (client)
  or not
- EventClass.subscribe() now throws errors of SendEventSubscription interceptors
- add function addChannel() to interface ServiceProviderManager, because adding channels to a manager after calling
  Nanium.addManager must be managed. The channel needs a back reference to its manager
- fixed a bug in Nanium.shutdown(). Now managers are also terminated correctly

# 1.19.9

- added NaniumObject.isPropertyDefined

# 1.19.8

- fixed NaniumBuffer.as(Buffer). Previously it used the internal ArrayBuffer to create the Buffer which sometimes is
  bigger then it has to be.
- fixed NaniumBuffer handling in http channel. Transmission-breaks within boundaries have not been handled before.

# 1.19.7

- added namespace parameter to nanium init cmd
- changed search for nanium.json - take the first nanium.json file from executing directory up to root that is found.
- added property requestInterceptors to browser provider config

# 1.19.6

- fixed bug: NaniumObject.Init: null or undefined ArrayProperties lead to in [ undefiend ] of [ null ].

# 1.19.5

- new methods of NaniumBuffer: .slice(), .read...LE()

## breaking changes

- NaniumBuffer constructor and method "write" no longer accept strings

# 1.19.4

- exclude all tests from packed package
- '@Type(Object)' now makes NaniumObjects methods to take the whole object as it is, even in strict mode, because it is
  explicitly marked as type Object/any.

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
