#!/usr/bin/env node

import { ErrorFormatter } from './core/ErrorFormatter.js';

const handleFatalError = (error: unknown): void => {
    console.error(ErrorFormatter.format(error));
    process.exit(1);
};

process.on('uncaughtException', handleFatalError);
process.on('unhandledRejection', handleFatalError);

await import('./providers/SqlServerProvider.js');
await import('./cli/index.js');
