# 1.19.0

- class NaniumBuffer
    - works on both nodejs and browser and can work with all Buffer formats from both worlds
    - you can write multiple times to the buffer and do not need to specify a size first. Data written to the buffer is
      not copied internally on write but on calling asUInt8Array() or asString()
    - can be used as Type for properties in requests to send big data together with other data but without serializing
      it (e.g. for uploading files as binaries).
- fixed naming of response type of generated contracts

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
