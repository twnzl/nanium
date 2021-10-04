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
	cp: copyFiles,
	ccp: cleanAndCopyFiles,
	sdk: function (): void {
		console.log('crate or update a sdk to to use the services in other projects');
	},
	rm: removeFiles,
	namespace: setNamespace,
	rsn: refreshServiceNames
};


// arguments
if (process.argv.length < 3 || !actions[process.argv[2]]) {
	console.log(`
nocat init
nocat generate | g {directory.}*{service name} {private|public} {namespace}
nocat rename {old service name} {new service name}
nocat pkg
nocat rm {file or folder}
		removes the file or folder
nocat cp {srcPath} {dstPath}
  	creates the destination path (recursively) if it does not exist
  	and copies files from srcPath recursively to dstPath
nocat ccp {srcPath} {dstPath}
	  creates the destination path (recursively) if it does not exist,
	  removes old files in the destination path
	  and than copies files from srcPath recursively to dstPath
nocat namespace {namespace}
		set namespace for all services that don't have a namespace
nocat rsn
		refresh service names. Set property serviceName of all requests and executors to the default (Namespace:RelativePath)
`);
	process.exit(0);
}

// read config file
let root: string;
const config: NocatToolConfig = (function (): NocatToolConfig {
	root = process.cwd();
	let configFromFile: Partial<NocatToolConfig> = {};
	let configFile: string;
	while (true) {
		configFile = path.join(root, 'nocat.json');
		if (fs.existsSync(configFile)) {
			configFromFile = JSON.parse(fs.readFileSync(configFile, 'utf8'));
			if (!configFromFile.namespace) {
				console.error('nocat.json: namespace not found');
				process.exit(1);
			}
			break;
		}
		if (path.resolve(path.join(root, '/..')) === root) {
			if (!configFromFile) {
				console.error('nocat.json not found');
				process.exit(1);
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
function copyFiles(args: string[]): void {
	const src: string = args[0];
	const dst: string = args[1];
	shell.mkdir('-p', dst);
	shell.cp('-R', src + '/*', dst);
}

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
	const cwdRelativeToServiceDirectory: string = process.cwd()
		.replace(root, '')
		.replace(config.serviceDirectory, '')
		.replace(/^[\\/]/, '')
		.replace(/^[\\/]/, '');
	let parts: string[] = args[0].split(args[0].indexOf('/') >= 0 ? '/' : '.');
	if (cwdRelativeToServiceDirectory) {
		parts = [
			...cwdRelativeToServiceDirectory.split(args[0].indexOf('/') >= 0 ? '/' : '.'),
			...parts
		];
	}
	const relativeToRoot: string = '../'.repeat(parts.length - 1) || './';
	const subPath: string = parts.slice(0, parts.length - 1).join('/');
	const coreClassName: string = parts.map((n: string) => n[0].toUpperCase() + n.substring(1)).join('');
	const serviceLastName: string = parts.slice(-1).join('');
	const executorFileName: string = path.join(root, config.serviceDirectory, subPath, serviceLastName + '.executor.ts');
	const contractFileName: string = path.join(root, config.serviceDirectory, subPath, serviceLastName + '.contract.ts');
	const scope: string = args[1] || 'private';
	const prefix: string = args[2] || config.namespace;

	// check if service with that name already exists
	if (fs.existsSync(executorFileName) || fs.existsSync(contractFileName)) {
		console.error('Nothing changed because the service already exists!');
		process.exit(1);
	}

	const templateData: object = {
		relativeToRoot,
		subPath: subPath,
		coreClassName: coreClassName,
		serviceLastName,
		prefix,
		indentString: config.indentString,
		config,
		scope
	};

	// create executor file
	const executorFileContent: string = fromTemplate('executor.ts.template', templateData);
	fs.mkdirSync(path.dirname(executorFileName), { recursive: true });
	fs.writeFileSync(executorFileName, executorFileContent);
	console.log('created: ' + executorFileName);

	// create contract file
	const contractFileContent: string = fromTemplate('contract.ts.template', templateData);
	fs.mkdirSync(path.dirname(contractFileName), { recursive: true });
	fs.writeFileSync(contractFileName, contractFileContent);
	console.log('created: ' + contractFileName);
}

// function renameService (args: string[]) {
// 	let parts: string[];
// 	if (args[0].indexOf('/') >= 0) {
// 		parts = args[0].split('/');
// 	} else {
// 		parts = args[0].split('.');
// 	}
// }

function init(): void {
	let fileContent: string;
	fs.mkdirSync(config.serviceDirectory, { recursive: true });

	// nocat.json
	fileContent = JSON.stringify({
		serviceDirectory: 'src/server/services',
		indentString: '\t',
		namespace: ''
	}, null, 2);
	fs.writeFileSync(path.join(process.cwd(), 'nocat.json'), fileContent);

	// serviceRequestBase.ts
	fileContent = fromTemplate('serviceRequestBase.ts.template');
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceRequestBase.ts'), fileContent);

	// serviceRequestHead.ts
	fileContent = fromTemplate('serviceRequestHead.ts.template');
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceRequestHead.ts'), fileContent);

	// serviceRequestContext.ts
	fileContent = fromTemplate('serviceRequestContext.ts.template');
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceRequestContext.ts'), fileContent);

	// request.interceptor.ts
	fileContent = fromTemplate('interceptor.ts.template');
	fs.writeFileSync(path.join(config.serviceDirectory, 'main.interceptor.ts'), fileContent);
}

async function setNamespace([namespace]: string): Promise<void> {
	let fileContent: string;
	const files: string[] = await findFiles(config.serviceDirectory,
		[(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.executor.ts') && !f.endsWith('.contract.ts')]);
	for (const file of files) {
		fileContent = fs.readFileSync(file, { encoding: 'utf8' });
		fileContent = fileContent
			.replace(/static serviceName: string = '(.*?)\.(.*?)'/g, 'static serviceName: string = \'' + namespace + ':$2' + '\'') // if actually other namespace is defined
			.replace(/static serviceName: string = '([^.]*?)'/g, 'static serviceName: string = \'' + namespace + ':$1' + '\''); // if actually no namespace is defined
		fs.writeFileSync(file, fileContent);
	}
}

async function refreshServiceNames(): Promise<void> {
	let fileContent: string;
	const files: string[] = await findFiles(config.serviceDirectory,
		[(f: string, stats: Stats): boolean => !stats.isDirectory() && !f.endsWith('.executor.ts') && !f.endsWith('.contract.ts')]);
	for (const file of files) {
		let relativeFileName: string = file.split(config.serviceDirectory)[1];
		relativeFileName = relativeFileName.substr(1, relativeFileName.length - 13);
		fileContent = fs.readFileSync(file, { encoding: 'utf8' });
		fileContent = fileContent
			.replace(/static serviceName: string = '(.*?)\.(.*?)'/g, 'static serviceName: string = \'' + config.namespace + ':' + relativeFileName + '\'') // if actually other namespace is defined
			.replace(/static serviceName: string = '([^.]*?)'/g, 'static serviceName: string = \'' + config.namespace + ':' + relativeFileName + '\''); // if actually no namespace is defined
		fs.writeFileSync(file, fileContent);
	}
}

function fromTemplate(name: string, data?: object): string {
	const template: string = fs.readFileSync(path.join(__dirname, 'templates/' + name), { encoding: 'utf8' })
		.replace(/\t/g, config.indentString);
	if (data) {
		return template.replace(/\${([^}]*)}/g, (r: string, k: string) => data[k]);
	} else {
		return template;
	}
}
