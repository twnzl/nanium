# nanium

Nanium is the material that modern web applications and APIs are made of.

It is a nanoservice based fullstack software architecture framework that takes full advantage of typescript to solve
many problems of traditional ways of building client-server applications.

## Features

* seamlessly type-save even across API borders
* full-featured objects (instead of plain data transfer objects) on both sides of the API
* maximum reusable logic for server and client
* easily exchangeable transfer protocols (http, websockets, tcp, ...) and formats (json, xml, ...).
* automatic generation of SDKs for the services you offer
* decide at build time how to host your services (microservices, monolith, ...) and which services shall be included
* faster, cleaner and more flexible way to develop software

## Short and sweet

1. create a service

```bash
nanium g stuff/get public
```

2. execute it, no mather if you are on the server or the client

```ts
const response: Stuff = new StuffGetRequest({ id: 1 }).execute();
```

3. enjoy the response as a full-featured object

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
    - [Video tutorials](#Video-tutorials)
        - [Concepts](#Concepts)
        - [Best practices](#Best-practices)
        - [Demo app](#Demo-app)
    - [Initialization](#Initialization)
        - [Init the server (nodejs)](#Init-the-server-(nodejs))
        - [Init the client (browser)](#Init-the-client-(browser))
    - [Services](#Services)
        - [Create a service](#Create-a-service)
        - [Execute a service](#Execute-a-service)
    - [Streaming](#Streaming)
    - [Interceptors](#Interceptors)
    - [Queues](#Queues)
    - [Events](#Events)
    - [Tests](#Tests)

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
$ nanium init
```

This will create the config file 'nanium.json' and the directory 'services' containing the following files:

- main.interceptor.ts
- serviceRequestBase.ts
- serviceRequestContext.ts
- serviceRequestHead.dto.ts
- streamServiceRequestBase.ts

For now, leave them as they are. Later you can adapt this to meet your needs.

In the 'nanium.json'

Next create a node script, initiate a default Http Server and add a ServiceProvider with a http channel. Channels are
ways to through which public services can be executed from outside the server (e.g. a webclient using http/websockets or
another server using tcp).

```ts
const httpServer: HttpServer = http.createServer(() => {
});
httpServer.listen(3000);

await Nanium.addManager(new NaniumNodejsProvider({
	requestChannels: [
		new NaniumHttpChannel({
			apiPath: '/api',
			server: httpServer
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
nanium g stuff/get public
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
		// todo: Do what ist described through the request. Than calculate and return the response.
	}
}
```

### Execute a service

No mather if you are in the node script that hosts the service or in the browser - it is always the same, and you do not
need to care about:

```ts
const response = new StuffRequest().execute();
```

## Streaming

If you want a service executor to provide the possibility to send multiple parts of the results you can create a
streamed service by:

```bash
nanium gs stuff/query public
```

The generated service will have a stream function that must return an Observable. The base class will automatically add
the execute function that returns a promise, so the caller is free to use both.

```ts
export class TestQueryExecutor implements StreamServiceExecutor<TestQueryRequest, TestDto> {
	static serviceName: string = 'NaniumTest:test/query';
	intervalHandle: any;

	stream(request: TestQueryRequest, executionContext: ServiceRequestContext): Observable<TestDto> {
		let i: number = 1;
		return new Observable((observer: Observer<TestDto>): void => {
			this.interval = setInterval(() => {
				observer.next({ aNumber: i++ });
			}, 1000);
			if (i >= 11) {
				clearInterval(intervalHandle);
				observer.complete();
			}
		});
	}
}
```

The overall result of this example service is a List of instances of class TestDto. But it will return only one per
second until 10. So the client can, for example, show the result list immediately and subscribe to the Observable to add
each new record as soon as it will arrive. It is not recommended using this to implement a sort of event mechanism.
Events will be supported directly by nanium shortly. It is meant for that clients must not wait for the whole response
of an expensive operation but can start to use parts of it as soon as they are available.

## Exception/Error handling

If a service executor throws an Error, it can be caught as usual when using promises. Again no mather if within the
server or on a remote client.

```ts
try {
	const response = new StuffRequest().execute();
} catch (e: Error) {
	document.write(e.message);
}
```

Because streamed services would return Observables you would use the error handler of the Observable in that case.

```ts
const response = new StuffRequest().stream().subscribe({
	next: (value: TestDto): void => {
		dtoList.push(value);
	},
	complete: (): void => resolve(),
	error: (e: Error) => {
		document.write(e.message);
	}
});
```

## Interceptors

An interceptor is some code that can analyze or change a request on consumer site before it is sent to a provider or on
provider site before it will be executed. Typically, you would use this e.g. on a web client to add authentication
information to the request before it will be sent to the server, or on the server site to check the authentication.

### implement a request interceptor for consumer site

In this example a client-request-interceptor is implemented as an angular service. If the user has already logged into
the application it adds the auth-token from the users' session. Additionally, it adds the preferred language and
timezone of the current user so the server can take this into account. The head of the ServiceRequestBase class ist the
best place for such always needed/usable information. If the user is not logged in, it loads the login page and returns
undefined to cancel the request.

```ts
@Injectable({ providedIn: 'root' })
export class ClientRequestInterceptorService implements ServiceRequestInterceptor<any> {

	constructor(private session: SessionService) {
	}

	async execute(request: ServiceRequestBase<any, any>): Promise<ServiceRequestBase<any, any>> {
		if (!this.session.isLoggedIn && request.head && (!request.head.email || !request.head.password)) {
			await this.router.navigate(['/login']);
			return undefined;
		}
		request.head = request.head || {};
		if (!request.head.email && !request.head.password) {
			request.head.token = this.session.token;
		}
		request.head.language = navigator.language || navigator['userLanguage'];
		request.head.timezone = Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone;

		return request;
	}
}
```

### implement a request interceptor for provider site

ng init will create an example interceptor 'main.interceptor.ts', you can use it as a template for a serverside request
interceptor. For an authentication interceptor e.g. check the user and password (or whatever) in the request and add the
user entity from the database to the executionContext, so the executor or later interceptors will have access to the
whole user information. If the credentials are not right, throw an error.

```ts
import { ServiceRequestInterceptor } from 'nanium/interfaces/serviceRequestInterceptor';
import { ServiceRequestBase } from './serviceRequestBase';
import { ServiceRequestContext } from './serviceRequestContext';

export class RequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {

	async execute(request: ServiceRequestBase<any, any>, executionContext: ServiceRequestContext): Promise<ServiceRequestBase<any, any>> {
		if (
			request.head.userName === 'jack' && request.head.password === '1234' ||
			request.head.userName === 'jenny' && request.head.password === '4321'
		) {
			executionContext.user = Database.get<User>('request.head.userName'); // pseudo code           
		} else {
			throw new Error('not authorized');
		}
		return request;
	}
}

```

### register an interceptor

Set the property 'requestInterceptors' of the provider or consumer that is passed to the Nanium.addManager() function.
It is an array of interceptor classes (need a parameterless constructor), so you can add multiple interceptors which are
executed sequentially according to its order in the array.

```ts
await Nanium.addManager(new NaniumConsumerBrowserHttp({
	apiUrl: '/api',
	requestInterceptors: [MyInterceptorService]
}));
```

### skip interceptors

E.g. If you have an interceptor that checks authentication, but you want to have a service that is callable without
authorization (anonymous), you can skip the execution of this interceptor for this special service. To do that use the
property 'skipInterceptors' of the RequestType Decorator. If set to true, then all interceptors are skipped. If you only
want to skip specific interceptors use an array with the interceptor classes to skip.

```ts
@RequestType({
	responseType: ServiceResponseBase,
	skipInterceptors: [MyInterceptorService],
	scope: 'public'
})
export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'NaniumTest:test/anonymous';
}
```

## Queues

Maybe you want to execute a request at a later time or periodically, or you just want to have a log of executed requests
and it's results, and a chance to restart any failed requests. Or things like that. Then a request queue is what you
need.

Every nanoservice within a nanium based app can be executed via queue. You just have to decide what kind of queue you
want to use, and make it known to nanium. Use an existing queue or provide your own (use a database, the filesystem, a
google sheet or whatever - it's up to you). E.g. using the mongodb queue, which holds requests in a mongodb collection,
would look like this:

### Install the wanted queue

```bash
npm i --save nanium-queue-mongodb
```

### Add the queue

```ts
const mongoQueue = new NaniumMongoQueue({
	checkInterval: 10,
	serverUrl: 'mongodb://localhost:27017',
	databaseName: 'nanium_test',
	collectionName: 'rq',
});
await Nanium.addQueue(mongoQueue);
```

### Add a request from code

```ts
await new AdminInfoMailSendRequest('hello admin').enqueue({ startDate: new Date('2099-31-01T00:00:00.000Z') });
```

This is a server-only-feature because of security reasons. To use it from a client, just crate a public service that
wraps the enqueue and use your default authorization mechanism.

### Add a request directly into the queue

Of course, you can also add requests directly to the collection using a mongodb client or the shell or whatever. State
must be 'ready';

```js
db.requestQueue.insert([
  {
    "serviceName": "NaniumDemo:adminInfoMail/send",
    "groupId": "",
    "request": {
      "body": {
        text: "hello admin"
      }
    },
    "response": null,
    "state": "ready",
    "startDate": "2085-02-06T14:40:24.555Z",
    "endDate": null,
    "interval": 3600,
    "endOfInterval": null
  }])
```

## Tests

## Events

coming soon!

## REST
           
