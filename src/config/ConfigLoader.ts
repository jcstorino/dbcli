import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

import { ConnectionConfig } from '../types/ConnectionConfig.js';

interface ConfigFile {
    connections: ConnectionConfig[];
}

export class ConfigLoader {
    public static resolvePath(): string {
        return this.resolveConfigFile();
    }

    public static load(connectionName: string): ConnectionConfig {
        const fileName = this.resolveConfigFile();

        if (!fs.existsSync(fileName)) {
            throw new Error('Connection configuration file not found.');
        }

        const content = fs.readFileSync(fileName, 'utf8');

        const config = parse(content) as ConfigFile;

        const connection = config.connections.find(
            (c) => c.name.toLowerCase() === connectionName.toLowerCase()
        );

        if (!connection) {
            throw new Error(`Connection '${connectionName}' not found.`);
        }

        return connection;
    }

    private static resolveConfigFile(): string {
        const explicitConfig = process.env.DBCLI_CONFIG;

        if (explicitConfig) {
            return path.resolve(explicitConfig);
        }

        for (const baseDir of this.getCandidateDirectories()) {
            const localFile = path.join(baseDir, 'connections.local.yaml');

            if (fs.existsSync(localFile)) {
                return localFile;
            }

            const exampleFile = path.join(baseDir, 'connections.local.example.yaml');

            if (fs.existsSync(exampleFile)) {
                return exampleFile;
            }
        }

        return path.resolve(process.cwd(), 'connections.local.yaml');
    }

    private static getCandidateDirectories(): string[] {
        const packageRoot = path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '..',
            '..'
        );

        return [
            process.cwd(),
            packageRoot,
        ];
    }
}
