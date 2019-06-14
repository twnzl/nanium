#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

export class NocatToolConfig {
	serviceDirectory: string;
	indentString: string;
}

// arguments
if (process.argv.length <= 3) {
	console.log(`
nocat init
nocat generate [service name]
nocat rename [old service name] [new service name]
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
			break;
		}
		if (path.resolve(path.join(root, '/..')) === root) {
			break;
		}
		root = path.resolve(path.join(root, '/..'));
	}
	return {
		...{
			serviceDirectory: 'src/server/services',
			indentString: '\t'
		},
		...configFromFile
	};
})();


// define dictionary with action-functions
const actions: { [actionName: string]: Function } = {
	generate: generateService,
	rename: function (): void {
		console.log('not yet implemented');
	},
	init: function (): void {
		console.log('not yet implemented');
	}
};


// determine and execute action
const command: string = process.argv[2];
actions[command](process.argv.slice(3));


// action functions


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

	// todo check if service with that name already exists

	// create executor file
	const executorFileContent: string = `
import { ServiceExecutor } from 'nocat';
import { ${serviceName}Request, ${serviceName}Response } from './${serviceLastName}.contract';

export default class ${serviceName}Executor implements ServiceExecutor<${serviceName}Request, ${serviceName}Response> {
${config.indentString}static serviceName: string = '${serviceName}';

${config.indentString}async execute(request: ${serviceName}Request): Promise<${serviceName}Response> {
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

export class ${serviceName}Request extends ServiceRequestBase<${serviceName}RequestBody, ${serviceName}ResponseBody> {
${config.indentString}static serviceName: string = '${serviceName}';
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
