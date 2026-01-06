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
			// require('karma-spec-reporter')
		],
		reporters: ['kjhtml'],
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
			clearContext: true,
			// useIframe: true,
			jasmine: {
				random: false,
				failFast: false,
				verboseDeprecations: true
			}
		},

		browserDisconnectTolerance: 0,
		browserDisconnectTimeout: 5000,
		browserNoActivityTimeout: 10000,

		// Important: prevents “eternal idleness”
		processKillTimeout: 2000,

		// Increase logging detail
		logLevel: config.LOG_INFO,

		// Other standard config...
		port: 9876,
		colors: true,
		// browsers: ['Chrome'],
		browsers: ['ChromeDebugging'],
		customLaunchers: {
			ChromeDebugging: {
				base: 'Chrome',
				flags: [
					'--remote-debugging-port=9222',
					'--disable-background-timer-throttling',
					'--disable-backgrounding-occluded-windows',
					'--disable-renderer-backgrounding',
					'--no-sandbox'
				]
			}
		},
		singleRun: false,
		autoWatch: true,
		// browsers: ['ChromeHeadless'],
		restartOnFileChange: false
	});
};
