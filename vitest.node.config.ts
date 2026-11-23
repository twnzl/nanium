import * as ts from 'typescript';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * esbuild (used by vite/vitest by default to strip types) implements TypeScript's legacy decorators
 * differently than tsc: for a property decorator that references its own enclosing class
 * (e.g. `@Type(MyClass) next: MyClass;` inside `class MyClass {...}`), esbuild emits an inner class
 * expression with an underscore-prefixed name (`class _MyClass {...}`), which changes `MyClass.name`
 * at runtime and breaks nanium's type introspection (NaniumObject.traverseType/createJsonSchemas).
 * Also, esbuild renames the common decorator-lowering pattern `let X = class X {}` to `class X2` even
 * without any decorators, for its own internal scope bookkeeping, which has the same effect.
 * This plugin transpiles .ts files with the real TypeScript compiler instead, so decorator output
 * matches the `tsc`-based production build exactly; `esbuild: false` keeps vite from re-processing
 * (and re-mangling) that already-transpiled, plain-JS output.
 */
function tscDecoratorsPlugin(): Plugin {
	const configFile = ts.readConfigFile(new URL('./tsconfig.json', import.meta.url).pathname, ts.sys.readFile);
	const { options } = ts.parseJsonConfigFileContent(configFile.config, ts.sys, process.cwd());
	return {
		name: 'nanium-tsc-decorators',
		enforce: 'pre',
		transform(code, id) {
			if (!id.endsWith('.ts')) {
				return null;
			}
			const result = ts.transpileModule(code, {
				compilerOptions: {
					...options,
					module: ts.ModuleKind.ESNext,
					sourceMap: true,
					inlineSourceMap: false,
				},
				fileName: id,
			});
			return {
				code: result.outputText,
				map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
			};
		},
	};
}

// configuration for running the nodejs/server unit tests (replaces the former jest based "test:server" setup,
// because jest's experimental ESM support hangs on files that use `import.meta.url` and does not reliably
// handle the dynamic `import()` calls that NaniumProviderNodejs uses to load service contracts/executors
// at runtime).
export default defineConfig({
	esbuild: false,
	plugins: [tscDecoratorsPlugin()],
	test: {
		name: 'node',
		environment: 'node',
		globals: true,
		testTimeout: 5000,
		fileParallelism: false,
		include: [
			'_src/**/*.spec.ts',
		],
		exclude: [
			'node_modules/**',
			'_src/tests/browser/**',
			'_src/tests/browser-client/**',
		],
	},
});
