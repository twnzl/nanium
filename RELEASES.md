# 1.18.1 (current)

- more general type definitions for interceptors

# 1.18.0 (current)

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
