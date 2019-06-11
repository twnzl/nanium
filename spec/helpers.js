const TSConsoleReporter = require('jasmine-ts-console-reporter');
console.log('####################');
jasmine.getEnv().clearReporters(); // Clear default console reporter
jasmine.getEnv().addReporter(new TSConsoleReporter());
