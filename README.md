# nanium

Nanium is the material that modern web applications and APIs are made of. It is a nanoservice based fullstack software
architecture framework that takes full advantage of typescript to solve many problems of traditional ways of building
client-server applications.

## Features

* seamlessly type-save even across API borders
* full-featured objects (instead of plain data transfer objects) on both sides of the API
* maximum reusable logic for server and client
* easily exchangeable transfer protocols (http, websockets, tcp, ...) and formats (json, xml, ...).
* automatic generation of SDKs for the services you offer
* decide at build time how to host your services (microservices, monolith, ...) and which services shall be included
* faster, cleaner and more flexible way to develop software

## Short and sweet

1. create a service:

```bash
npx nanium g stuff/get public
```

2. execute it no mather if you are on the server or the client

```ts
const response: Stuff = new StuffGetRequest({ id: 1 }).execute();
```

3. enjoy response as a full-featured object

```ts
if (response.isGoodStuff()) {
	console.log(response.aDate.toLocaleString() + ' :-)');
}
```

## Table of contents

- [Features](#Features)
- [Short and sweet](#Short-and-sweet)
- [Philosophy](#Philosophy)
- [Installation](#Installation)
- [Documentation](#Documentation)
    - [Video tutorials](#Video tutorials)
        - [Concepts](#Concepts)
        - [Best practices](#Demo app)
        - [Demo app](#Demo app)
    - [Initialization]
        - [Init the server (nodejs)](#Init-the-server-(nodejs))
        - [Init the client (browser)](#Init-the-client-(browser))
    - [Services]
        - [Create a service](#Create a service)
        - [Execute a service](#Execute a service)
    - [Interceptors]
    - [Queues]
    - [Tests]
    - ...

## Philosophy

todo: big picture (architecture)

## Installation

```bash
$ npm install nanium
```

## Documentation

### Video tutorials

Probably the best way to start are the video tutorials at ...
(coming soon!)

#### Concepts

- [Basics]
- [Interceptors]
- [Streaming]
- [Queuing]
- [Events]
- [SDKs]

#### Best practices

- [Authorization]
- [Validation]
- [Tests]
- [Caching]
- [Packaging]
- [Creating own channels, consumers, queues]
- ...

#### Demo app

You can download a ready-to-take-off-demo app via

```bash
$ git clone nanium-demo
```

## Initialization

### Init the server (nodejs)

```bash
$ npx nanium init
```

This will create the config file 'nanium.json' and the directory 'services' containing the following files:

- serviceRequestBase.ts
- serviceRequestContext.ts
- serviceRequestHead.dto.ts
- serviceRequestQueueEntry.ts
- streamServiceRequestBase.ts

For now, leave them as they are. Later you can adapt this to meet your needs.

Next create a node script, initiate a default Http Server and add a ServiceProvider with a http channel. Channels are
ways to through which public services can be executed from outside the server (e.g. a webclient using http/websockets or
another server using tcp).

```ts
const httpServer: HttpServer = http.createServer(() => {
});
httpServer.listen(8080);

await Nanium.addManager(new NaniumNodejsProvider({
	requestChannels: [
		new NaniumHttpChannel({
			apiPath: '/api',
			server: httpServer,
			executionContextConstructor: Object
		})
	]
}));
```

### Init the client (browser)

```ts
await Nanium.addManager(new NaniumConsumerBrowserHttp({ apiUrl: '/api' }));
```

## Services

### Create a service

```bash
npx nanium g stuff/get public
```

This will generate two files:

- __services/stuff/get.contract.ts__: The contract for the service. The request defines information that a service
  consumer must supply if he wants the service to be executed. And the response defines which information the result of
  the service execution will contain.

```ts
import { ServiceRequestBase } from '../serviceRequestBase';
import { RequestType } from 'nanium/serializers/core';

export class StuffGetRequestBody {
}

export class StuffGetResponse {
}

@RequestType({
	responseType: StuffGetResponse,
	genericTypes: {
		TRequestBody: StuffGetRequestBody
	},
	scope: 'public'
})
export class StuffGetRequest extends ServiceRequestBase<StuffGetRequestBody, StuffGetResponse> {
	static serviceName: string = 'NaniumTest:stuff/get';
}

``` 

Probably most of the time you would use instances of your domains entities instead of StuffGetRequestBody and
StuffGetResponse. So you can delete this generated classes and define your own either within the same .contract.ts file
or in a separate file but with the extension __.contractpart.ts__.

- __services/stuff/get.executor.ts__: The implementation of the service. It uses the values of the request and
  calculates the response.

```ts
import { ServiceExecutor } from 'nanium/interfaces/serviceExecutor';
import { StuffGetRequest, StuffGetResponse } from './get.contract';
import { ServiceRequestContext } from '../serviceRequestContext';

export class StuffGetExecutor implements ServiceExecutor<StuffGetRequest, StuffGetResponse> {
	static serviceName: string = 'NaniumTest:stuff/get';

	async execute(request: StuffGetRequest, executionContext: ServiceRequestContext): Promise<StuffGetResponse> {
		// todo: Do what ist descriped through the request. Than calculate and return the response.
	}
}
```

### Execute a service

No mather if you are in a node script or in the browser it is always the same, and you do not need to care about:

```ts
const response = new StuffRequest().execute();
```
