#!/usr/bin/env node
import * as fs from 'fs';
import { Stats } from 'fs';
import * as path from 'path';
import * as shell from 'shelljs';
import * as findFiles from 'recursive-readdir';
import * as util from 'util';
import * as readline from 'readline';
import { Interface } from 'readline';

export class NaniumToolConfig {
	eventsDirectory: string;
	serviceDirectory: string;
	indentString: string;
	namespace: string;
	sdkPackage: any; // Package.json for the sdk package
	sdkTsConfig: any;
	outDir?: string;
}

// define dictionary with action-functions
const actions: { [actionName: string]: Function } = {
	init: init,
	g: generateService,
	gs: generateStreamService,
	ge: generateEvent,
	namespace: setNamespace,
	rsn: refreshServiceNames,
	cp: copyFiles,
	ccp: cleanAndCopyFiles,
	rm: removeFiles,
	sdk: sdk
};

const rl: Interface = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// arguments
if (process.argv.length < 3 || !actions[process.argv[2]]) {
	console.log(`
nanium init
		generate nanium.json service+event directory and the nanium base classes
nanium g {directory/}*{service name} {private|public} {namespace}
		generate files for a new service (contract + executor)
nanium gs {directory/}*{service name} {private|public} {namespace}
		generate files for a new streamed service (contract + executor)
nanium ge {directory/}*{event name} {private|public} {namespace}
		generate file for a new event
nanium rm {file or folder}
		removes the file or folder
nanium cp {srcPath} {dstPath}
  	creates the destination path (recursively) if it does not exist
  	and copies files from srcPath recursively to dstPath
nanium ccp {srcPath} {dstPath}
	  creates the destination path (recursively) if it does not exist,
	  removes old files in the destination path
	  and than copies files from srcPath recursively to dstPath
nanium namespace {namespace}
		set namespace for all services that don't have a namespace
nanium rsn
		refresh service names. Set property serviceName of all requests and executors to the default (Namespace:RelativePath)
nanium sdk {b|p|u}
		with parameter b: bundle the contract files to a .tgz file
		with parameter p: use npm publish and the information of nanium.json.sdkPackage to publish the contracts to npm repository
		with parameter u: use npm publish and the information of nanium.json.sdkPackage to unpublish the contracts in npm repository
`);
	process.exit(0);
}

// read config file
let root: string;
const config: NaniumToolConfig = (function (): NaniumToolConfig {
	root = process.cwd();
	let configFromFile: Partial<NaniumToolConfig> = {};
	let configFile: string;
	while (true) {
		configFile = path.join(root, 'nanium.json');
		if (fs.existsSync(configFile)) {
			configFromFile = JSON.parse(fs.readFileSync(configFile, 'utf8'));
			if (!configFromFile.namespace) {
				console.error('nanium.json: namespace not found');
				process.exit(1);
			}
			break;
		}
		if (path.resolve(path.join(root, '/..')) === root) {
			root = process.cwd();
			break;
		}
		root = path.resolve(path.join(root, '/..'));
	}
	return {
		...{
			serviceDirectory: 'src/server/services',
			eventsDirectory: 'src/server/events',
			indentString: '\t',
			namespace: 'NaniumTest',
			sdkPackage: {},
			sdkTsConfig: {
				'compilerOptions': {
					'module': 'commonjs',
					'sourceMap': false,
					'declaration': true,
					'watch': false,
					'noEmitOnError': false,
					'emitDecoratorMetadata': true,
					'experimentalDecorators': true,
					'target': 'ES2020',
					'lib': ['ES2020'],
					'types': ['node']
				}
			}
		},
		...configFromFile
	};
})();
const packageJson: any = require(path.join(root, 'package.json'));

// determine and execute action
const command: string = process.argv[2];


(async function (): Promise<void> {
	await actions[command](process.argv.slice(3));
	process.exit();
})();

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

async function generateService([servicePath, scope, namespace]: [string, string, string]): Promise<void> {
	return new Promise<void>(resolve => {
		if (!scope) {
			rl.question('Which scope shall the service have?\n  1: private\n  2: public\n[1]: ', (input: '1' | '2') => {
				scope = input === '2' ? 'public' : 'private';
				generateServiceCore('contract.ts.template', 'executor.ts.template', servicePath, scope, namespace);
				resolve();
			});
		} else {
			generateServiceCore('contract.ts.template', 'executor.ts.template', servicePath, scope, namespace);
			resolve();
		}
	});
}

function generateStreamService([servicePath, scope, namespace]: [string, string, string]): void {
	generateServiceCore('streamContract.ts.template', 'streamExecutor.ts.template', servicePath, scope, namespace);
}

function generateServiceCore(
	contractTemplate: string, executorTemplate: string,
	servicePath: string, scope: string, namespace: string
): void {
	const cwdRelativeToServiceDirectory: string = process.cwd()
		.replace(root, '')
		.replace(config.serviceDirectory, '')
		.replace(/^[\\/]/, '')
		.replace(/^[\\/]/, '');
	let parts: string[] = servicePath.split(servicePath.indexOf('/') >= 0 ? '/' : '.');
	if (cwdRelativeToServiceDirectory) {
		parts = [
			...cwdRelativeToServiceDirectory.split(servicePath.indexOf('/') >= 0 ? '/' : '.'),
			...parts
		];
	}
	const relativeToRoot: string = '../'.repeat(parts.length - 1) || './';
	const subPath: string = parts.slice(0, parts.length - 1).join('/');
	const coreClassName: string = parts.map((n: string) => n[0].toUpperCase() + n.substring(1)).join('');
	const serviceLastName: string = parts.slice(-1).join('');
	const executorFileName: string = path.join(root, config.serviceDirectory, subPath, serviceLastName + '.executor.ts');
	const contractFileName: string = path.join(root, config.serviceDirectory, subPath, serviceLastName + '.contract.ts');
	scope = scope ?? 'private';
	namespace = namespace ?? config.namespace;

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
		prefix: namespace,
		indentString: config.indentString,
		config,
		scope
	};

	// create executor file
	const executorFileContent: string = fromTemplate(executorTemplate, templateData);
	fs.mkdirSync(path.dirname(executorFileName), { recursive: true });
	fs.writeFileSync(executorFileName, executorFileContent);
	console.log('created: ' + executorFileName);

	// create contract file
	const contractFileContent: string = fromTemplate(contractTemplate, templateData);
	fs.mkdirSync(path.dirname(contractFileName), { recursive: true });
	fs.writeFileSync(contractFileName, contractFileContent);
	console.log('created: ' + contractFileName);
}

function generateEvent([eventsPath, scope, namespace]: [string, string, string]): void {
	const cwdRelativeToEventsDirectory: string = process.cwd()
		.replace(root, '')
		.replace(config.eventsDirectory, '')
		.replace(/^[\\/]/, '')
		.replace(/^[\\/]/, '');
	let parts: string[] = eventsPath.split(eventsPath.indexOf('/') >= 0 ? '/' : '.');
	if (cwdRelativeToEventsDirectory) {
		parts = [
			...cwdRelativeToEventsDirectory.split(eventsPath.indexOf('/') >= 0 ? '/' : '.'),
			...parts
		];
	}
	const relativeToRoot: string = '../'.repeat(parts.length - 1) || './';
	const subPath: string = parts.slice(0, parts.length - 1).join('/');
	const coreClassName: string = parts.map((n: string) => n[0].toUpperCase() + n.substring(1)).join('');
	const lastName: string = parts.slice(-1).join('');
	const eventFileName: string = path.join(root, config.eventsDirectory, subPath, lastName + '.executor.ts');
	scope = scope ?? 'private';
	namespace = namespace ?? config.namespace;

	// check if an event with that name already exists
	if (fs.existsSync(eventFileName)) {
		console.error('Nothing changed because the event already exists!');
		process.exit(1);
	}

	const templateData: object = {
		relativeToRoot,
		subPath: subPath,
		coreClassName: coreClassName,
		serviceLastName: lastName,
		prefix: namespace,
		indentString: config.indentString,
		config,
		scope
	};

	// create executor file
	const fileContent: string = fromTemplate('event.ts.template', templateData);
	fs.mkdirSync(path.dirname(eventFileName), { recursive: true });
	fs.writeFileSync(eventFileName, fileContent);
	console.log('created: ' + eventFileName);
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

	// nanium.json
	fileContent = JSON.stringify({
		serviceDirectory: 'src/server/services',
		indentString: '\t',
		namespace: '',
		outDir: 'sdk',
		sdkPackage: {
			name: 'myServices',
			description: 'SDK for my services',
			author: 'unknown',
			license: 'MIT',
			keywords: [
				'my',
				'contracts',
				'sdk',
				'API'
			]
		},
		sdkTsConfig: {
			'compilerOptions': {
				'module': 'commonjs',
				'sourceMap': false,
				'declaration': true,
				'watch': false,
				'noEmitOnError': false,
				'emitDecoratorMetadata': true,
				'experimentalDecorators': true,
				'target': 'ES2020',
				'lib': ['ES2020'],
				'types': ['node']
			}
		}
	}, null, 2);
	fs.writeFileSync(path.join(process.cwd(), 'nanium.json'), fileContent);

	// serviceRequestBase.ts
	fileContent = fromTemplate('serviceRequestBase.ts.template');
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceRequestBase.ts'), fileContent);

	// streamServiceRequestBase.ts
	fileContent = fromTemplate('streamServiceRequestBase.ts.template');
	fs.writeFileSync(path.join(config.serviceDirectory, 'streamServiceRequestBase.ts'), fileContent);

	// serviceRequestHead.ts
	fileContent = fromTemplate('serviceRequestHead.ts.template');
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceRequestHead.ts'), fileContent);

	// serviceRequestContext.ts
	fileContent = fromTemplate('serviceRequestContext.ts.template');
	fs.writeFileSync(path.join(config.serviceDirectory, 'serviceRequestContext.ts'), fileContent);

	// request.interceptor.ts
	fileContent = fromTemplate('interceptor.ts.template');
	fs.writeFileSync(path.join(config.serviceDirectory, 'main.interceptor.ts'), fileContent);

	// eventBase.ts
	fileContent = fromTemplate('eventBase.ts.template');
	fs.writeFileSync(path.join(config.eventsDirectory, 'eventBase.ts'), fileContent);
}

async function setNamespace([namespace]: [string]): Promise<void> {
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

async function sdk([kind]: ['a' | 'p' | 'u']): Promise<void> {
	// output directory
	const outDir: string = path.join(root, config.outDir ?? '');
	if (!fs.existsSync(outDir)) {
		shell.mkdir('-p', outDir);
	}

	// create temp dir
	let tmpDir: string = '_tmp';
	while (fs.existsSync(path.join(outDir, tmpDir))) {
		tmpDir = '_' + tmpDir;
	}
	tmpDir = path.join(outDir, tmpDir);
	shell.mkdir(tmpDir);

	try {
		const serviceSrcDir: string = path.join(root, config.serviceDirectory);
		const tmpSrcDir: string = path.join(tmpDir, 'src');
		const tmpDstDir: string = path.join(tmpDir, 'dst');
		shell.mkdir('-p', tmpSrcDir);
		shell.mkdir('-p', tmpDstDir);

		// package.json
		config.sdkPackage.version = packageJson.version;
		fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(config.sdkPackage, null, 2));

		// README
		if (fs.existsSync(path.join(serviceSrcDir, 'README'))) {
			shell.cp(path.join(serviceSrcDir, 'README'), tmpDir);
		}

		// tsconfig.json
		config.sdkTsConfig.compilerOptions = config.sdkTsConfig.compilerOptions ?? {};
		config.sdkTsConfig.compilerOptions.outDir = path.join(tmpDir, 'dst');
		if (!config.sdkTsConfig.include) {
			config.sdkTsConfig.include = [
				'**/*.contract.ts',
				'**/*.contractpart.ts',
				'**/*.dto.ts'
			];
		} else {
			config.sdkTsConfig.include.push('**/*.contract.ts');
			config.sdkTsConfig.include.push('**/*.dto.ts');
		}
		fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), JSON.stringify(config.sdkTsConfig, null, 2));

		// nanium basics
		shell.cp(path.join(serviceSrcDir, 'serviceRequestBase.ts'), path.join(tmpDir, 'src'));
		shell.cp(path.join(serviceSrcDir, 'streamServiceRequestBase.ts'), path.join(tmpDir, 'src'));

		// copy contract ts files to src dir
		const files: string[] = await findFiles(serviceSrcDir, [(f: string, stats: Stats): boolean =>
			!stats.isDirectory() &&
			!f.endsWith('.contract.ts') &&
			!f.endsWith('\\contractpart.ts') && !f.endsWith('/contractpart.ts') && !f.endsWith('.contractpart.ts') &&
			!f.endsWith('\\dto.ts') && !f.endsWith('/dto.ts') && !f.endsWith('.dto.ts')
		]);
		let dstFile: string;
		let srcFileContent: string;
		for (const file of files) {
			srcFileContent = fs.readFileSync(file, { encoding: 'utf8' });
			// check if a request is public
			// todo: maybe using the typescript-compiler-api is a bit safer
			if (
				srcFileContent.match(/static\s+scope\s*(.*?)=\s*['"`]public['"`]/g) ||
				srcFileContent.match(/@RequestType\s*\(\s*{[\s\S]*?scope\s*:\s*['"`](public)['"`][\s\S]*?}\s*\)/g)
			) {
				dstFile = path.join(tmpDir, 'src', path.relative(serviceSrcDir, file));
				shell.mkdir('-p', path.dirname(dstFile));
				fs.copyFileSync(file, dstFile);
			}
		}

		// compile contracts
		shell.cd(path.join(tmpDir, 'src'));
		shell.exec('tsc');

		// bundle or publish package
		shell.cp(path.join(tmpDir, 'package.json'), path.join(tmpDstDir, 'package.json'));
		if (fs.existsSync(path.join(tmpDir, 'README'))) {
			shell.cp(path.join(tmpDir, 'README'), path.join(tmpDstDir, 'README'));
		}

		shell.cd(tmpDstDir);
		if (kind === 'p') {
			shell.exec('npm publish');
		} else if (kind === 'u') {
			shell.exec(`npm unpublish ${config.sdkPackage.name}@${config.sdkPackage.version}`);
		} else {
			shell.exec('npm pack');
			shell.cd(root);
			let packageFileName: string = `${config.sdkPackage.name}-${config.sdkPackage.version}.tgz`;
			packageFileName = path.join(tmpDstDir, packageFileName);
			shell.cp(packageFileName, outDir);
		}
	} catch (e) {
		console.log(util.inspect(e, false, 3));
	} finally {
		// cleanup
		shell.cd(root);
		shell.rm('-R', tmpDir);
	}
}
