// karma.conf.js
module.exports = function (config) {
	config.set({
		basePath: '',
		frameworks: ['jasmine', '@angular-devkit/build-angular'],
		plugins: [
			require('karma-jasmine'),
			require('karma-chrome-launcher'),
			require('karma-jasmine-html-reporter'),
			require('karma-coverage'),
			require('@angular-devkit/build-angular/plugins/karma'),
			require('karma-spec-reporter')
		],
		reporters: ['spec', 'kjhtml'],
		specReporter: {
			maxLogLines: 5,
			suppressErrorSummary: false,
			suppressFailed: false,
			suppressPassed: false,
			suppressSkipped: false,
			showSpecTiming: true,
			failFast: false,
			prefixes: {
				success: '✓ ',
				failure: '✗ ',
				skipped: '- '
			},
			// real-time reporting
			spec: {
				displayStacktrace: true,
				displaySuccessful: true,
				displayFailed: true,
				displayPending: true, // Show tests before they run
				displayDuration: true
			},
			// Ensure failures are reported immediately
			summary: {
				displayErrorMessages: true,
				displaySuccessful: true,
				displayFailed: true,
				displayPending: true
			}
		},

		client: {
			clearContext: false,
			jasmine: {
				random: false,
				failFast: false,
				verboseDeprecations: true
			}
		},

		// Increase logging detail
		logLevel: config.LOG_INFO,

		// Other standard config...
		port: 9876,
		colors: true,
		autoWatch: false,
		browsers: ['ChromeHeadless'],
		singleRun: true,
		restartOnFileChange: true
	});
};
