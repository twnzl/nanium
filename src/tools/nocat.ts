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
	let executorFileName: string = path.join(path.resolve(config.serviceDirectory), 'executors');
	let contractFileName: string = path.join(path.resolve(config.serviceDirectory), 'contracts');
	let root: string = '';
	let contractDir: string = 'contracts';
	let serviceName: string = '';
	for (const segment of args[0].split('.')) {
		contractFileName = path.join(contractFileName, segment);
		executorFileName = path.join(executorFileName, segment);
		root = path.join('..', root);
		contractDir = path.join(contractDir, segment);
		serviceName += segment[0].toUpperCase() + segment.substr(1);
	}
	contractDir = path.join(root, contractDir);
	executorFileName += '.executor.ts';
	contractFileName += '.contract.ts';

	// todo check if service with that name already exists

	// create executor file
	const executorFileContent: string = `
import { ServiceExecutor } from 'nocat';
import { ${serviceName}Request, ${serviceName}Response } from '${contractDir}.contract';

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
import { ServiceRequestBase } from '${root}/serviceRequestBase';
import { ServiceResponseBase } from '${root}/serviceResponseBase';

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
