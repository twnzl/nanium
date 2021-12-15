# nanium

Nanium is the material that modern web applications and APIs are made of.

It is a nanoservice-based fullstack software architecture framework that takes full advantage of typescript to solve
many problems of traditional ways of building client-server applications.

## Features

* seamlessly type-save even across API borders
* full-featured objects (instead of plain data transfer objects) on both sides of the API
* maximum reusable logic for server and client
* easily exchangeable transfer protocols (http, websockets, tcp, etc.) and formats (json, xml, etc.).
* automatic generation of SDKs for the services you offer
* decide at build time how to host your services (microservices, monolith, etc.) and which services should be included
* faster, cleaner and more flexible way to develop software

## Short and sweet

1. create a service

```bash
nanium g stuff/get public
```

2. execute it whether you are on the server or the client

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
- [Installation](#Installation)
- [Documentation](#Documentation)
    - [Video tutorials](#Video-tutorials)
    - [Demo app](#Demo-app)
    - [Initialization](#Initialization)
        - [Init the server (nodejs)](#Init-the-server-(nodejs))
        - [Init the client (browser)](#Init-the-client-(browser))
    - [Services](#Services)
        - [Create a service](#Create-a-service)
        - [Execute a service](#Execute-a-service)
        - [Prepare the contracts](#Prepare-the-contracts)
    - [Streaming](#Streaming)
    - [Interceptors](#Interceptors)
    - [Queues](#Queues)
    - [Events](#Events)
    - [SDKs](#SDKs)
    - [Tests](#Tests)
    - [REST](#REST)
    - [Extensibility](#Extensibility)

## Installation

```bash
$ npm install nanium
```

## Documentation

### Video tutorials

The best way to get started is to watch the video tutorials at
https://www.youtube.com/channel/UCV0pLzUzkdGazPXKJoGDjow (coming soon!)

### Demo app

You can download a ready-to-take-off demo app via

```bash
$ git clone https://github.com/twnzl/nanium-demo.git
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

In the 'nanium.json' enter a namespace.

Next create a node script, initiate a default Http Server and add a ServiceProvider with an HTTP channel. Channels are
ways to through which public services can be executed from outside the server (e.g. a web client using http/websockets
or another server using tcp).

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

Probably most of the time you would use instances of your domain's entities instead of StuffGetRequestBody and
StuffGetResponse. So you can delete these generated classes and define your own, either within the same .contract.ts
file or in a separate file but with the extension __.contractpart.ts__.

- __services/stuff/get.executor.ts__: The implementation of the service. It uses the values of the request and
  calculates the response.

```ts
import { ServiceExecutor } from 'nanium/interfaces/serviceExecutor';
import { StuffGetRequest, StuffGetResponse } from './get.contract';
import { ServiceRequestContext } from '../serviceRequestContext';

export class StuffGetExecutor implements ServiceExecutor<StuffGetRequest, StuffGetResponse> {
	static serviceName: string = 'NaniumTest:stuff/get';

	async execute(request: StuffGetRequest, executionContext: ServiceRequestContext): Promise<StuffGetResponse> {
		// todo: Do what is described through the request, calculate the resppnse and return it.
	}
}
```

### Execute a service

Whether you're in the node script that hosts the service or in the browser, it's the same thing, and you do not have to
worry about.

```ts
const response = new StuffRequest().execute();
```

### Prepare the contracts

Unfortunately, the typescript compiler still does not support the generation of type information that can be used at
runtime. But this information is necessary to make the contract serialization and deserialization work. Therefore,
nanium uses decorators to fill this gap.

Currently, there are three essential decorators.

- __@Type()__: All properties of a contract class or subclass that do not have a primitive type must be decorated with
  @Type(). The parameter is the class/constructor of the decorated property.
- __@GenericType()__: If a property has a generic type that uses a type variable from the parent class, an identifier
  for this type variable must be provided using @GenericType()
- __@RequestType()__: Use the property 'responseType' to set the class of the response. And for each defined generic
  type identifier specify the concrete class using the property 'genericTypes'

Example:

```ts
export class GenericStuff<TStuffSubType> {
	aString?: string;
	aNumber?: number;
	aBoolean?: boolean;

	@GenericType('TStuffSubType')
	theGeneric?: TStuffSubType;
}


export enum StuffEnum {
	zero = 'z',
	one = 'o',
	two = 't'
}

export class Stuff<TStuffSubType> {
	aString?: string;
	aNumber?: number;
	aBoolean?: boolean;
	anEnum?: StuffEnum;

	@Type(Date)
	aDate?: Date;

	@Type(Stuff)
	anObject?: Stuff<TStuffSubType>;

	@Type(Stuff)
	anObjectArray?: Stuff<TStuffSubType>[];

	aStringArray?: string[];

	@Type(GenericStuff)
	aGenericObject?: GenericStuff<TStuffSubType>;

	@Type(GenericStuff)
	aGenericObjectArray?: GenericStuff<TStuffSubType>[];

	get aCalculatedProperty(): string {
		return this.aStringArray?.join(' ');
	}

	aFunction(): number {
		return this.aStringArray?.length;
	}
}

@RequestType({
	responseType: Stuff,
	genericTypes: {
		TStuffSubType: Date,
		TRequestBody: Stuff,
		TResponseBody: Stuff,
		TPartialResponse: Stuff
	},
	scope: 'public'
})
export class StuffRequest extends ServiceRequestBase<Stuff<Date>, Stuff<Date>[]> {
	static serviceName: string = 'NaniumTest:test/stuff';
}
```

Further decorators are planned, with which you will have more options to adjust which data will leave the server in
which case. For example properties can be skipped depending on the executing user or rights or other properties of the
executionContext.

```ts
const response = new StuffRequest().execute();
```

## Streaming

If you want a service executor to provide the possibility to return partial results, you can create a streamed service
by:

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
each new record as soon as it arrives. It is not recommended using this to implement a sort of event mechanism. Events
will be supported directly by nanium shortly. It is meant so that clients do not have to wait for the whole response of
an expensive operation but can start to use parts of it as soon as they are available.

## Exception/Error handling

If a service executor throws an Error, it can be caught as usual when using promises. Again, it does not matter whether
you are on the server or on a remote client.

```ts
try {
	const response = new StuffRequest().execute();
} catch (e: Error) {
	document.write(e.message);
}
```

Since streamed services would return Observables you would use the error handler of the Observable in that case.

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

An interceptor is a piece of code that can analyse or modify a request, either on the consumer side before it is sent to
a provider, or on the provider side before it is executed. Typically, you would use this e.g. on a web client to add
authentication information to the request before it will be sent to the server, or on the server site to check the
authentication.

### implement a request interceptor for consumer site

In this example a client request interceptor is implemented as an angular service. If the user has already logged into
the application it adds the auth-token from the users' session. Additionally, it adds the preferred language and time
zone of the current user so the server can take this into account. The head of the ServiceRequestBase class is the best
place for this type of always needed/usable information. If the user is not logged in, it loads the login page and
returns undefined to cancel the request.

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

"nanium init" will create an example interceptor 'main.interceptor.ts', which you can use as a template for a
server-side request interceptor. For an authentication interceptor e.g. check the user and password (as the case may be)
in the request and add the user entity from the database to the executionContext, so the executor or later interceptors
will have access to all user information. If the credentials are not right, throw an error.

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
It is an array of interceptor classes (needing a parameterless constructor) or instances, so you can add multiple
interceptors which are executed sequentially according to its order in the array.

```ts
await Nanium.addManager(new NaniumConsumerBrowserHttp({
	apiUrl: '/api',
	requestInterceptors: [MyInterceptorService]
}));
```

### skip interceptors

For example, if you have an interceptor that checks authentication, but you want to have a service that is callable
without authorization (anonymous), you can skip the execution of this interceptor for this special service. To do so use
the property 'skipInterceptors' of the RequestType Decorator. If set to true, then all interceptors are skipped. If you
only want to skip specific interceptors, use an array with the interceptor classes or instances to skip.

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
and their results, and a chance to restart any failed requests, or similar. In that case, a request queue is what you
need.

Every nanoservice within a nanium-based app can be executed via queue. You just have to decide what kind of queue you
want to use, and make it known to nanium. Use an existing queue or provide your own (use a database, the filesystem, a
Google sheet or whatever you prefer - it's up to you). For Example, using the mongodb queue, which holds requests in a
mongodb collection, would look like this:

### Install the desired queue

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

This is a server-only feature because of security reasons. To use it from a client, just crate a public service that
wraps the enqueue and use your default authorization mechanism.

### Add a request directly into the queue

Of course, you can also add requests directly to the collection using a mongodb client or the shell, etc. The state must
be set to 'ready';

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

Due to the loosely coupled nature of nanium, it is easy to swap implementations. So in your server unit tests you should
just leave the servicePath-Property of the NaniumNodejsProvider empty, so no services will be registered. And in the
second step, add the original service you want to test. And add mock implementations for services that are used by this
test unit.

```ts
// init nanium
beforeEach(async () => {
	const provider: NaniumNodejsProvider = new NaniumNodejsProvider({/* servicePath: '' */ });
	await Nanium.addManager(provider);
	provider.addService(StuffCalculateRequest, SuffCalculateExecutor);
	provider.addService(MockStuffStoreRequest, MockStuffQueryExecutor);
	provider.addService(MockStuffQueryRequest, class {
		async execute(_request: MockStuffQueryRequest, _executionContext: ServiceRequestContext): Promise<StuffDto[]> {
			return [];
		}
	});
});

beforeEach(async () => {
	await Nanium.shutdown();
});
```

## Events

**(experimental)** Currently, the NaniumHttpChannel has basic support for this feature, but it is still experimental.

A provider can emit Events:

```ts
new StuffAddedEvent(stuff).emit(executionContext);
```

Consumers may subscribe to events:

```ts
await StuffAddedEvent.subscribe((value: Stuff) => {
	refreshLocalCache<Stuff>(stuff);
});
```

Via Nanium.addManager you can configure which channel should be used for the transmission of events, and you can add
event interceptors.

**server:**

```ts	
await Nanium.addManager(new NaniumNodejsProvider({
	servicePath: 'services',
	channels: [
	    new NaniumHttpChannel({ apiPath: '/api', eventPath: '/events', server: server })
	],
	eventSubscriptionReceiveInterceptors: [DemoEventSubscriptionReceiveInterceptor],
	eventEmissionSendInterceptors: [DemoEventEmissionSendInterceptor]
}));
```

**browser:**

```ts
await Nanium.addManager(new NaniumConsumerBrowserHttp({
	apiUrl: 'http://localhost:3000/api',
	apiEventUrl: 'http://localhost:3000/events',
	eventSubscriptionSendInterceptors: [DemoEventSubscriptionSendInterceptor]
}));
```

## SDKs

If you want to use your services in another project, or if you want to provide an easy way for other people to use them,
you can easily create an SDK.

```bash
nanium sdk b 
```

This will generate a npm bundle as a .tgz file, that contains all your public contracts.

```bash
nanium sdk p 
```

Using the option "p", will publish it directly to the npm registry. So, after using "npm i nanium <your-sdk>" in the
other project, you will have all you need to create and execute requests of the oder project/domain. Just use the __
isResponsible__ property to adjust which nanium-provider or nanium-consumer is responsible for which services. Most of
the time, the namespace of the services should be enough to distinguish that.

```ts
// foreign services
const domain1ServiceConsumer: NocatConsumerNodejsHttp = new NocatConsumerNodejsHttp({
	apiUrl: "http://.../api",
	isResponsible: (_request: any, serviceName: string) => Promise.resolve(serviceName.startsWith('Domain1:') ? 'yes' : 'no')
});
await Nocat.addManager(domain1ServiceConsumer);

// own services
const myServiceProvider: NocatNodejsProvider = new NocatNodejsProvider({
	servicePath: path.join(__dirname, 'services'),
	isResponsible: (_request: any, _serviceName: string) => Promise.resolve('fallback'),
});
await Nocat.addManager(myServiceProvider);
```

You can use the property "sdkPackage" in the nanium.json to specify all the values you want to have in the package.json
of the sdk bundle. And if you want to have other settings for the Typescript compiler, you can set them in the "
sdkTsConfig" property in the nanium.json.

The sdk functions will surely be completed one day, so that alternatively to the SDK a standard API documentation can be
generated as an alternative to the SDK, but for Typescript users the SDK is far better than just documentation.

## REST

When RESTful webservices became current, they felt really cool. Mainly because they released us from things like soap
services, which had been far more stressful. They also made us feel like we were using the HTTP protocol correctly.

But let's be honest: If you had a choice, would you really use it for web services?

It is the protocol that governs the internet. Every browser speaks it, many tools are based on it and nearly every
device can deal with it out of the box. Therefore, it is the best choice. But what favor do we do ourselves, when we
force ourselves to decode the input for services into a URI - always struggling with the correct form. It is much less
than only untyped. Why should we try to map the responses of our services to ancient HTTP-Codes that have been designed
for something completely different? And yes, it may be a kind of sporting challenge trying to transform a service
oriented thinking to a resource oriented thinking, but does this really help?

Yes, we should use HTTP, but we should not hardwire our service logic to this ancient protocol, so that we can change it
if something better appears on the horizon. And we should not feel guilty, if we for example just always use a post to
send data, because even if REST appears to be more correct, it is also just abuse of a protocol designed for something
different.

Nevertheless, if you don't want to do without nanium features yourself but still feel better if you can offer a REST
service, then nanium makes it possible.

```bash
npm i nanium-channel-express-rest
```

```ts
this.expressApp = express();
this.expressApp.listen(3000);

await Nanium.addManager(new NaniumNodejsProvider({
	servicePath: 'dist/testservices',
	requestChannels: [
		new NaniumExpressRestChannel({
			apiBasePath: '/api',
			expressApp: this.expressApp
		})
	]
}));
```

This provides a REST-style API using the paths of service contract files to create the endpoint and the name of the
contract file to choose the HTTP method. It is not perfect, but if you want more just use it as a base to extend it.

## Extensibility

Nanium defines interfaces for all its basic parts and each of these building blocks is interchangeable. So you can
create your own managers (provider or consumer), channels, interceptors, serializers and queues.   
Just write your own component that implements the corresponding interface.
