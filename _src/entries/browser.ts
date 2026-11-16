// Entry point for code that only runs in a browser (web client) environment.
// Import it via `import { ... } from 'nanium/browser';`.
// Re-exports everything from 'nanium/core' in addition to the browser-specific classes, so that client
// applications typically only need this single entry point.

export * from './core.js';

export * from '../managers/consumers/browserHttp.js';
export * from '../managers/consumers/browserWs.js';
export * from '../managers/providers/browser.js';
