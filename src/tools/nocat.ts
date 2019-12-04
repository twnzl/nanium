#!/usr/bin/env node
import * as fs from 'fs';
import { Stats } from 'fs';
import * as path from 'path';
import * as shell from 'shelljs';
import * as findFiles from 'recursive-readdir';

export class NocatToolConfig {
	serviceDirectory: string;
	indentString: string;
	namespace: string;
}

// define dictionary with action-functions
const actions: { [actionName: string]: Function } = {
	g: generateService,
	generate: generateService,
	rename: function (): void {
		console.log('renaming of services is not yet implemented');
	},
	init: init,
	pkg: function (): void {
		console.log('creating a binary for the app is not yet implemented');
	},
	ccp: cleanAndCopyFiles,
	sdk: function (): void {
		console.log('creating a binary for the app is not yet implemented');
	},
	rm: removeFiles,
	namespace: setNamespace
};


// arguments
if (process.argv.length < 3 || !actions[process.argv[2]]) {
	console.log(`
nocat init
nocat generate | g {directory.}*{service name} {private|public} {namespace}
nocat rename {old service name} {new service name}
nocat pkg
nocat ccp {srcPath} {dstPath} -- like bash cp but cares about creating destination path and removes old files in destination path
nocat rm {file or folder} -- removes the file or folder
nocat namespace {namespace}
`);
	process.exit(0);
}

// read config file
const config: NocatToolConfig = (function (): NocatToolConfig {
	let root: string = process.cwd();
	let configFromFile: Partial<NocatToolConfig> = {};
	let configFile: string;
	while (true) {
		configFile = path.join(root, 'nocat.json');
		if (fs.existsSync(configFile)) {
			configFromFile = JSON.parse(fs.readFileSync(configFile, 'utf8'));
			if (!configFromFile.namespace) {
				throw new Error('nocat.json: namespace not found');
			}
			break;
		}
		if (path.resolve(path.join(root, '/..')) === root) {
			if (!configFromFile) {
				throw new Error('nocat.json not found');
			}
			break;
		}
		root = path.resolve(path.join(root, '/..'));
	}
	return {
		...{
			serviceDirectory: 'src/server/services',
			indentString: '\t',
			namespace: 'NocatTest'
		},
		...configFromFile
	};
})();

// determine and execute action
const command: string = process.argv[2];
actions[command](process.argv.slice(3));

// action functions
function cleanAndCopyFiles(args: string[]): void {
	const src: string = args[0];
	const dst: string = args[1];
	shell.mkdir('-p', dst);
	shell.rm('-rf', dst);
	shell.mkdir('-p', dst);
	shell.cp('-R', src + '/*', dst);
}

function removeFiles(args: string[]): void {
	console.log(shell.rm('-rf', args[0]).toString());
}

function generateService(args: string[]): void {
	let parts: string[];
	if (args[0].indexOf('/') >= 0) {
		parts = args[0].split('/');
	} else {
		parts = args[0].split('.');
	}
	const relativeToRoot: string = '../'.repeat(parts.length - 1) || './';
	const subPath: string = parts.slice(0, parts.length - 1).join('/');
	const serviceName: string = parts.map((n: string) => n[0].toUpperCase() + n.substring(1)).join('');
	const serviceLastName: string = parts.slice(-1).join('');
	const executorFileName: string = path.join(config.serviceDirectory, subPath, serviceLastName + '.executor.ts');
	const contractFileName: string = path.join(config.serviceDirectory, subPath, serviceLastName + '.contract.ts');
	const scope: string = args[1] || 'private';
	const prefix: string = args[2] || config.namespace;

	// todo check if service with that name already exists

	// create executor file
	const executorFileContent: string = `
import { ServiceExecutor } from 'nocat';
import { ${serviceName}Request, ${serviceName}Response } from './${serviceLastName}.contract';
import { ServiceRequestContext } from '${relativeToRoot}serviceRequestContext';

export default class ${serviceName}Executor implements ServiceExecutor<${serviceName}Request, ${serviceName}Response> {
${config.indentString}static serviceName: string = '${prefix}.${serviceName}';

${config.indentString}async execute(request: ${serviceName}Request, executionContext: ServiceRequestContext): Promise<${serviceName}Response> {
${config.indentString}${config.indentString}return new ${serviceName}Response({});
${config.indentString}}
}

`;
	fs.mkdirSync(path.dirname(executorFileName), { recursive: true });
	fs.writeFileSync(executorFileName, executorFileContent);
	console.log('created: ' + executorFileName);

	// create contract file
	const contractFileContent: string = `
import { ServiceRequestBase } from '${relativeToRoot}serviceRequestBase';
import { ServiceResponseBase } from '${relativeToRoot}serviceResponseBase';
import { ServiceExecutionScope } from 'nocat';

export class ${serviceName}Request extends ServiceRequestBase<${serviceName}RequestBody, ${serviceName}ResponseBody> {
${config.indentString}static serviceName: string = '${prefix}.${serviceName}';
${config.indentString}static scope: ServiceExecutionScope = ServiceExecutionScope.${scope};
${config.indentString}static skipInterceptors: boolean = false;
}

export class ${serviceName}RequestBody {
}

export class ${serviceName}Response extends ServiceResponseBase<${serviceName}ResponseBody> {
}

export class ${serviceName}ResponseBody {
}

`;
	fs.mkdirSync(path.dirname(contractFileName), { recursive: true });
	fs.writeFileSync(contractFileName, contractFileContent);
	console.log('created: ' + contractFileName);
}

function init() {
	let fileContent: string;
	fs.mkdirSync(config.serviceDirectory, { recursive: true });

	// serviceRequestBase.ts
	fileContent = `import { Nocat, ServiceRequest, ServiceExecutionContext } from 'nocat';
import { ServiceRequestHead } from './serviceRequestHead';

export class ServiceRequestBase<TRequestBody, TResponse> implements ServiceRequest<TResponse> {

\thead: ServiceRequestHead;
\tbody: TRequestBody;

\tconstructor(body?: TRequestBody, head?: ServiceRequestHead) {
\t\tthis.body = body || {} as TRequestBody;
\t\tthis.head = head;
\t}

\tasync execute(context?: ServiceExecutionContext): Promise<TResponse> {
\t\treturn await Nocat.execute(this, undefined, context);
\t}
}
`.replace(/\t/g, config.indentString);
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceRequestBase.ts'), fileContent);

	// serviceRequestHead.ts
	fileContent = `export class ServiceRequestHead {
\tuserName?: string;
\tpassword?: string;
\ttoken?: string;
\tlanguage?: string;
}
`.replace(/\t/g, config.indentString);
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceRequestHead.ts'), fileContent);

	// serviceRequestContext.ts
	fileContent = `import { ServiceExecutionContext, ServiceExecutionScope } from 'nocat';

export class ServiceRequestContext implements ServiceExecutionContext {
\tscope?: ServiceExecutionScope;

\tconstructor(data: Partial<ServiceRequestContext>) {
\t\tObject.assign(this, data);
\t}
}
`.replace(/\t/g, config.indentString);
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceRequestContext.ts'), fileContent);

	// serviceError.ts
	fileContent = `export class ServiceError {
\tcode: string;
\ttext?: string;
\tproperties?: string[];

\tconstructor(public type: 'error' | 'exception') {
\t}

\tstatic error(code?: string, text?: string, properties?: string[]): ServiceError {
\t\tconst result: ServiceError = new ServiceError('error');
\t\tresult.code = code;
\t\tresult.text = text;
\t\tresult.properties = properties;
\t\treturn result;
\t}

\tstatic exception(code?: string, text?: string): ServiceError {
\t\tconst result: ServiceError = new ServiceError('exception');
\t\tresult.code = code;
\t\tresult.text = text;
\t\treturn result;
\t}
}

export enum ServiceErrorCodes {
\tunauthenticated = 'unauthenticated',
\tunauthorized = 'unauthorized',
\tbadRequest = 'badRequest',
\tnotUnique = 'notUnique'
}
`.replace(/\t/g, config.indentString);
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceError.ts'), fileContent);

	// request.interceptor.ts
	fileContent = `import { ServiceRequestBase } from './serviceRequestBase';
import { ServiceRequestInterceptor } from 'nocat';
import { ServiceRequestContext } from './serviceRequestContext';

export class RequestInterceptor implements ServiceRequestInterceptor<ServiceRequestBase<any, any>> {
\trequest: ServiceRequestBase<any, any>;
\texecutionContext: ServiceRequestContext;

\tasync execute(request: ServiceRequestBase<any, any>, executionContext: ServiceRequestContext): Promise<ServiceRequestBase<any, any>> {
\t\t// todo: checkAuthorization 
\t\treturn request;
\t}
}
`.replace(/\t/g, config.indentString);
	fs.writeFileSync(path.join(config.serviceDirectory, 'request.interceptor.ts'), fileContent);
}

async function setNamespace([namespace]: string): Promise<void> {
	let fileContent: string;
	const files: string[] = await findFiles(config.serviceDirectory,
		[(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.executor.ts') && !f.endsWith('.contract.ts')]);
	for (const file of files) {
		fileContent = fs.readFileSync(file, { encoding: 'utf8' });
		fileContent = fileContent
			.replace(/static serviceName: string = '(.*?)\.(.*?)'/g, 'static serviceName: string = \'' + namespace + '.$2' + '\'') // if actually other namespace is defined
			.replace(/static serviceName: string = '([^\.]*?)'/g, 'static serviceName: string = \'' + namespace + '.$1' + '\''); // if actually no namespace is defined
		fs.writeFileSync(file, fileContent);
	}
}
