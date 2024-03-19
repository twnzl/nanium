# nanium

Nanium is the material that modern web applications and APIs are made of.

It is a nanoservice-based fullstack software architecture framework that takes full advantage of typescript to solve
many problems of traditional ways of building client-server applications.

## Features

* seamlessly type-save even across API borders
* full-featured objects (instead of plain data transfer objects) on both sides of the API
* code completion for API calls and easy API-refactoring
* maximum reusable logic for server and client
* easily exchangeable transfer protocols (http, websockets, tcp, etc.) and formats (json, xml, etc.).
* automatic generation of SDKs for the services you offer
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
    - [Interceptors](#Interceptors)
    - [Serializers](#Serializers)
    - [Streaming](#Streaming)
    - [Queues](#Queues)
    - [Events](#Events)
    - [SDKs](#SDKs)
    - [Tests](#Tests)
    - [REST, GraphQL & Co](#REST,-GraphQL-&-Co)
    - [Extensibility](#Extensibility)

## Installation

```bash
$ npm install nanium
```

## Documentation

### Video tutorials

The best way to get started is to watch the video tutorials at
https://www.youtube.com/channel/UCV0pLzUzkdGazPXKJoGDjow

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
ways through which public services can be executed from outside the server (e.g. a web client using http/websockets
or another server using tcp).

```ts
import * as http from 'http';
import { Nanium } from 'nanium/core';
import { NaniumHttpChannel } from 'nanium/managers/providers/channels/http';
import { NaniumProviderNodejs } from 'nanium/managers/providers/nodejs';

const httpServer: http.Server = http.createServer(() => {
});
httpServer.listen(3000);

async function run(): Promise<void> {
	await Nanium.addManager(new NaniumProviderNodejs({
		channels: [
			new NaniumHttpChannel({
				apiPath: '/api',
				server: httpServer // https-server or an express-like app are also possible
			})
		]
	}));
}

run();
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
import { RequestType } from 'nanium/objects';
import { NaniumObject } from './objects';

export class StuffGetRequestBody extends NaniumObject<StuffGetRequestBody> {
}

export class StuffGetResponse extends NaniumObject<StuffGetResponse> {
}

@RequestType({
	responseType: StuffGetResponse,
	genericTypes: { TRequestBody: StuffGetRequestBody },
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
const response = await new StuffRequest().execute();
```

### Prepare the contracts

#### Decorators

Unfortunately, the typescript compiler still does not support the generation of type information that can be used at
runtime. But this information is necessary to make the contract serialization and deserialization work. Therefore,
nanium uses decorators to fill this gap.

Currently, there are two essential decorators.

- __@Type()__: Used for Properties. The first Parameter is either generic Type-ID if the property has a generic Type or
  it is the class/constructor of the property. The second parameter is a dictionary with GenericTypeIDs as key and
  class/constructor as value.
- __@RequestType()__: Use the property 'responseType' to set the class of the response. And for each defined generic
  type identifier specify the concrete class using the property 'genericTypes'

complex example:

```ts
import { NaniumObject } from './objects';

export class GenericStuff<TStuffSubType> extends NaniumObject<GenericStuff<TStuffSubType>> {
	@Type(String) aString?: string;
	@Type(Number) aNumber?: number;
	@Type(Boolean) aBoolean?: boolean;
	@Type('TStuffSubType') theGeneric?: TStuffSubType;
}

export enum StuffEnum {
	zero = 'z',
	one = 'o',
	two = 't'
}

export class Stuff<TStuffSubType> extends NaniumObject<Stuff<TStuffSubType>> {
	@Type(String) aString?: string;
	@Type(Number) aNumber?: number;
	@Type(Boolean) aBoolean?: boolean;
	@Type(String) anEnum?: StuffEnum;
	@Type(Date) aDate?: Date;

	// property 'theGeneric' of 'anObject' will be a Date 
	// as globaly set by decorator RequestType of surrounding Type StuffRequest
	@Type(Stuff) anObject?: Stuff<TStuffSubType>;
	// property 'theGeneric' of 'aGenericObject' will be a Number (local definition overwrites global)
	@Type(GenericStuff, { 'TStuffSubType': Number }) aGenericObject?: GenericStuff<TStuffSubType>;

	@Type(Array, Stuff) anObjectArray?: Stuff<TStuffSubType>[];
	@Type(Array, String) aStringArray?: string[];
	@Type(Array, GenericStuff) aGenericObjectArray?: GenericStuff<TStuffSubType>[];

	@Type(Object, Boolean) aBooleanDictionary: { [key: string]: Boolean };

	// the type of property 'config' is determined dynamically using the given arrow function   
	@Type(String) configType: 'a' | 'b';
	@Type((p: Stuff<any>) => a.configType === 'a' ? A : B) config: A | B;

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

#### initializers

In the example above, the contract classes extend the type NaniumObject. This is not necessary, but it automatically
provides an initializer constructor for classes. So when you create new instances, you can pass initial data to the
constructor and nanium will put the data into your new Object in a type save way. That means all property values, even
those of sub objects will be real instances of its classes defined by the Type decorators.

example:

```ts
class Person extends NaniumObject<Person> {
	@Type(String) name: string;
	@Type(Array, Person) friends?: Person[];
}

const john = new Person({
	name: 'John',
	friends: [
		new Person({ name: 'Jane' }),
		{ name: 'Bob' },
	]
});

if (john.friends[1] instanceof Person) {
	console.log([
		john.name,
		john.friends[0].name,
		john.friends[1].name
	].join(' & '));
}
```

The output is 'John & Jane & Bob'.

The initialization of Bob will also work, but if there are any getters or functions in class Person typescript will
complain that they are missing here. But not, when using the constructor like for Jane.

The constructor will have two more parameters. The second one you can use to specify Types for generic
type ids, if there are some. And if you set the third parameter *strict* to true nanium will ensure that only that
properties will be
created in the new instance, that are decorated with the Type decorator. This is e.g. useful to convert between internal
data structures and external data structures and to ensure no internal data leave the server and no invalid external
data are stored to the database.

#### ORM

When your business entities derive from **NaniumObject**, they automatically get basic ORM functionality that is
independent of the data source. Just load a record/object from any database and put it into the constructor of your
business entity class. Or if you get data via the API, do the same and only valid properties with correct type, reach
the entity and the database. If you do not want to use NaniumObject as a base class you can achieve the same with the
static functions of **NaniumObject** like **init**.

Maybe this will be extended in the future to provide additional features like property renaming or conditional property
mapping or extended validation.

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
			// pseudo code: Load the user entity from your database to the execution context, so it will be easily 
			// available in each executor
			executionContext.user = Database.get<User>(request.head.userName);
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
only want to skip specific interceptors, use an array with the names of the interceptor classes. To skip interceptors
depending on the execution scope, you can use an object with the scope as properties and bool or string array as values.

```ts
@RequestType({
	responseType: ServiceResponseBase,
	skipInterceptors: ['MyInterceptorService'],
	scope: 'public'
})
export class AnonymousRequest extends ServiceRequestBase<void, string> {
	static serviceName: string = 'NaniumTest:test/anonymous';
}
```

## Serializers

By default, objects are transported over the network as JSON. However, you can also use other serializers. For example,
to transfer data via UBJSON, XML, or any own binary format. For this you just need to implement the interface
**NaniumSerializer** and pass an instance of the serializer to the provider channels and consumers.

```ts
// server
await Nanium.addManager(
	new NaniumProviderNodejs({
		channels: [
			new NaniumHttpChannel({
				apiPath: '/api',
				eventPath: '/events',
				server: httpServer,
				serializer: new NaniumJsonSerializer(),
			}),
		]
	})
);

// consumer
const serializer = new NaniumJsonSerializer();
serializer.packageSeparator = '\0';
Nanium.addManager(
	new NaniumConsumerBrowserHttp({
		apiUrl: baseUrl + '/api',
		apiEventUrl: baseUrl + '/events',
		serializer: serializer,
		handleError: async (err: any): Promise<any> => {
			throw { handleError: err };
		}
	})
);
```

### Binary data

Regardless of which serializer you use, binary data is always treated specially. If you define the result type of a
service as NaniumBuffer, the data is not serialized or deserialized, but transported to the client as it
is.

```ts
// contract
@RequestType({
	responseType: NaniumBuffer,
	scope: 'public'
})
export class TestGetBinaryRequest extends SimpleServiceRequestBase<void, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getBinary';
}

// executor
export class TestGetBinaryExecutor implements ServiceExecutor<TestGetBinaryRequest, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getBinary';

	async execute(request: TestGetBinaryRequest, executionContext: ServiceRequestContext): Promise<NaniumBuffer> {
		return new NaniumBuffer('this is a text that will be send as binary data');
	}
}
```

NaniumBuffers can also be included as Properties of Requests. E.g. to send Files or other binary or large data together
with other information like IDs or file names etc.

```ts
// contract
import { NaniumBuffer } from './naniumBuffer';

@RequestType({ responseType: String, scope: 'public' })
export class TestMeasurementStoreRequest extends SimpleServiceRequestBase<void, string> {
	static serviceName: string = 'NaniumTest:test/bigData/Store';

	@Type(Date) startTime: Date;
	@Type(Date) endTime: Date;
	@Type(Array, String) enabledSensors: string[];
	@Type(NaniumBuffer) sensorValues: NaniumBuffer;
	@Type(NaniumBuffer) video: NaniumBuffer;
}

// executor
export class TestMeasurementStoreExecutor implements ServiceExecutor<TestMeasurementStoreRequest, string> {
	static serviceName: string = 'NaniumTest:test/bigData/Store';

	async execute(request: TestMeasurementStoreRequest, executionContext: ServiceRequestContext): Promise<string> {
		const id: string = randomUUID();
		await fs.promises.writeFile(id + '.mp4', request.body.video.asUint8Array());
		// ...
		return id;
	}
}
```

## Streaming

If you want a service executor to provide the possibility to return partial results, you can use NaniumStream as a
service result

```ts
@RequestType({
	responseType: [NaniumStream, TestDto],
	scope: 'public'
})
export class TestStreamedQueryRequest extends SimpleServiceRequestBase<TestStreamedQueryRequestBody, NaniumStream<TestDto>> {
	static serviceName: string = 'NaniumTest:test/streamedQuery';
}
```

The example shows an object stream. Result type NaniumStream<NaniumBuffer> would be a binary stream. On the callers side
the result can be consumed in small parts using the onData() function:

```ts
const response: NaniumStream<TestDto> = await new TestStreamedQueryRequest().execute();
response.onData((value: TestDto): void => dtoList.push(value));
response.onEnd(() => resolve());
response.onError((err: Error) => console.error(err));
```

It is also possible to consume the result as whole package using the toPromise() function.
Even in this case nanium will at least use the benefits of streaming internally - e.g. parallelism of
data transmission and deserialization.

```ts
const responseStream: NaniumStream<TestDto> = await new TestStreamedQueryRequest().execute();
const dtoList: TestDto[] = await responseStream.toPromise();
```

### Binary data

Regardless of which serializer you use, binary data is always treated specially. If you define the result-type of a
service as NaniumBuffer, the data is not serialized or deserialized, but transported to the client as it is.

```ts
// the contract
@RequestType({
	responseType: NaniumBuffer,
	scope: 'public'
})
export class TestGetStreamedBufferRequest extends ServiceRequestBase<void, NaniumBuffer> {
	static serviceName: string = 'NaniumTest:test/getStreamedBuffer';
}

// the executor
export class TestGetStreamedBufferExecutor implements StreamServiceExecutor<TestGetStreamedBufferRequest, ArrayBuffer> {
	static serviceName: string = 'NaniumTest:test/getStreamedBuffer';

	stream(request: TestGetStreamedBufferRequest, executionContext: ServiceRequestContext): Observable<ArrayBuffer> {
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

// the client call
new TestGetStreamedBufferRequest(undefined, { token: '1234' }).stream().subscribe({
	next: (part: NaniumBuffer): void => {
		console.log(part.asString());
		// output:
		// This
		//  is a string convert
		// ed to a Uint8Array
	}
});
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

## Events

**(experimental)** Currently, the NaniumHttpChannel has basic support for this feature, but it is still experimental.

A provider can emit events:

```ts
new StuffAddedEvent(stuff).emit(executionContext);
```

Consumers may subscribe to events ...

```ts
await StuffAddedEvent.subscribe((value: Stuff) => {
	// e.g. update app state or cache
});
```

... and unsubscribe:

```ts
const subscription = await StuffAddedEvent.subscribe((value: Stuff) => {
	// ...
});
// to deregister a specific handler, use the returned subscription
subscription.unsubscribe();
// or, to deregister all registered handler functions for an event type, use:
StuffAddedEvent.unsubscribe();
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
other project, you will have all you need to create and execute requests of the other project/domain. Just use the __
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

## Tests

Due to the loosely coupled nature of nanium, it is easy to swap implementations. So in your server unit tests you should
just leave the servicePath-Property of the NaniumNodejsProvider empty, so no services will be registered. And in the
second step, add the original service you want to test. And add mock implementations for services that are used by this
test unit.

### server tests

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

afterEach(async () => {
	await Nanium.shutdown();
});
```

### client tests

To test webclients you can add a (or an additional) **NaniumProviderBrowser** to the list of managers. The isResponsible
function should return a value higher than the one of the Consumer that normally handles server requests. So all server
requests can be mocked.

```ts
// init nanium
beforeEach(async () => {
	const mockServerProvider = new NaniumProviderBrowser({
		isResponsible: async (request, serviceName) => {
			return serviceName.startsWith('NaniumTest:') ? 2 : 0;
		},
		isResponsibleForEvent: async (eventName) => {
			return eventName.startsWith('NaniumTest:') ? 2 : 0;
		},
	});
	Nanium.addManager(mockServerProvider);
	mockServerProvider.addService(
		TestGetRequest,
		class {
			async execute(request: TestGetRequest): Promise<TestGetResponse> {
				return new TestGetResponse({
					output1: 'mock1',
					output2: 2222,
				});
			}
		}
	);
	// now all calls to new TestGetRequest(...).execute() will be handled by the mock implementation 
});

afterEach(async () => {
	await Nanium.shutdown();
});
```

## REST, GraphQL & Co

Nanoservices, especially Nanium services, are not hardwired to a protocol or any kind of API. The backend programmer can
just focus on implementing the logic and the frontend/client developer, while consuming the API, doesn't have to mess
around with protocols like HTTP or with code generators or special query languages and tether his logic to them.

If you are using typescript as an API consumer, you will usually want to use Nanium for calling the service to take
advantage of all the benefits of Nanium (e.g. IntelliSense, type safety or easy refactoring across API boundaries).
However, you can also call Nanium services via traditional ways.

On the one hand, the **NaniumHttpChannel** automatically provides a single-endpoint HTTP POST API:

```ts
const req: Request = new Request(
	'http://localhost:3001/api',
	{
		method: 'post',
		body: JSON.stringify({
			serviceName: "NaniumTest:Stuff/query",
			request: {
				body: {
					type: 'goodStuff'
				},
				head: {
					token: 'rmufas9i6fsfq2x32w38fdbs3sviv7frs54wldfuy3s7udfmheg1jz1owix9s8nv6hni',
					language: 'de-DE',
					timezone: 'Europe/Berlin'
				}
			}
		})
	}
);
fetch(req)
	.then(async (response) => {
		if (response.ok) {
			const data: Stuff[] = await response.json();
			console.log(data.length + ' items of good stuff received');
		} else {
			throw await response.json();
		}
	})    
```

In addition, other Nanium channels, in combination with other serializers, can present services to the outside world in
completely different ways (even in parallel). For example, the **NaniumRestChannel** makes the services available in the
usual REST manner using service contract files to create the endpoint and the name of the contract file to choose the
HTTP method. Of course, this could be realized even better - but it is only an example channel to show the principle.

```bash
npm i nanium-channel-rest
```

```ts
await Nanium.addManager(new NaniumProviderNodejs({
	servicePath: 'services',
	channels: [
		new NaniumHttpChannel({ apiPath: '/api', eventPath: '/events', server: server }),
		new NaniumRestChannel({ apiBasePath: '/api2', server: server })
	],
	eventSubscriptionReceiveInterceptors: [DemoEventSubscriptionReceiveInterceptor],
	eventEmissionSendInterceptors: [DemoEventEmissionSendInterceptor]
}));
```

```ts
const req: Request = new Request(
	'http://localhost:3001/api/stuff',
	{
		method: 'get',
		body: JSON.stringify({ // the body
			type: 'goodStuff'
		}),
		headers: { // the head
			token: 'rmufas9i6fsfq2x32w38fdbs3sviv7frs54wldfuy3s7udfmheg1jz1owix9s8nv6hni',
			language: 'de-DE',
			timezone: 'Europe/Berlin'
		}
	}
);
fetch(req)
	.then(async (response) => {
		if (response.ok) {
			const data: Stuff[] = await response.json();
			console.log(data.length + ' items of good stuff received');
		} else {
			throw await response.json();
		}
	})
```

## Extensibility

Nanium defines interfaces for all its basic parts and each of these building blocks is interchangeable. So you can
create your own managers (provider or consumer), channels, interceptors, serializers and queues.   
Just write a class that implements the corresponding interface.

### Plugins

Services written by third parties can be published as npm packages and easily be added to your app. The third party
should implement an init function that takes database connections or other configuration values and should return an
initialized Nanium service provider. Or it returns a list of pairs of request and executor class constructors, so you
can care for the service registration and the wanted channels yourself.

Since this enables plug-ins with well-defined API functions, suitable frontend components can also be implemented and
made available. In this way, complete parts of client-server applications can be provided - reusable in multiple
applications. Just think of a complete login and user management or an admin frontend for managing entries in nanium
queues. You can host this as a separate application or add it to an existing application. Or do the one today and the
other tomorrow or even both at the same time.

## Version info

Information about new features, breaking and non breaking changes and upgrade steps can be found
in [RELEASES](./RELEASES.md)
