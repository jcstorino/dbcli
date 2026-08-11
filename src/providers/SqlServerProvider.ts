import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sql, { config as SqlConfig } from 'mssql';

import { ProviderRegistry } from './ProviderRegistry.js';
import { DatabaseProvider } from './DatabaseProvider.js';
import { ConnectionConfig } from '../types/ConnectionConfig.js';
import { QueryResult } from '../types/QueryResult.js';

export class SqlServerProvider implements DatabaseProvider {
    private pool: sql.ConnectionPool | null = null;
    private config: ConnectionConfig | null = null;

    public async connect(config: ConnectionConfig): Promise<void> {
        this.config = config;
        const authentication = config.authentication ?? 'sql';

        if (authentication === 'windows') {
            return;
        }

        this.pool = await this.connectWithTedious(config, authentication);
    }

    public async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.close();
            this.pool = null;
        }
    }

    public async execute(sqlText: string): Promise<QueryResult> {
        if ((this.config?.authentication ?? 'sql') === 'windows') {
            return this.executeWithSqlClient(sqlText);
        }

        if (!this.pool) {
            throw new Error('Database is not connected.');
        }

        const result = await this.pool.request().query(sqlText);

        return {
            rows: result.recordset ?? [],
            rowCount: result.rowsAffected?.[0] ?? result.recordset.length ?? 0,
        };
    }

    private async connectWithTedious(
        config: ConnectionConfig,
        authentication: string
    ): Promise<sql.ConnectionPool> {
        const sqlConfig: SqlConfig = {
            server: config.server,
            port: config.port ?? 1433,
            database: config.database,
            requestTimeout: 0,
            options: {
                encrypt: config.encrypt ?? false,
                trustServerCertificate: config.trustServerCertificate ?? true,
            },
        };

        if (authentication === 'ntlm') {
            if (!config.domain || !config.username || !config.password) {
                throw new Error(
                    'Autenticacao NTLM exige domain, username e password.'
                );
            }

            sqlConfig.authentication = {
                type: 'ntlm',
                options: {
                    domain: config.domain,
                    userName: config.username,
                    password: config.password,
                },
            };
        } else {
            if (!config.username || !config.password) {
                throw new Error(
                    'Autenticacao SQL exige username e password.'
                );
            }

            sqlConfig.user = config.username;
            sqlConfig.password = config.password;
        }

        return sql.connect(sqlConfig);
    }

    public streamQuery(sqlText: string): Readable {
        if ((this.config?.authentication ?? 'sql') === 'windows') {
            const readable = new Readable({
                objectMode: true,
                read() {},
            });

            void this.executeWithSqlClient(sqlText)
                .then((result) => {
                    for (const row of result.rows) {
                        readable.push(row);
                    }

                    readable.push(null);
                })
                .catch((error: unknown) => {
                    readable.destroy(
                        error instanceof Error ? error : new Error(String(error))
                    );
                });

            return readable;
        }

        if (!this.pool) {
            throw new Error('Database is not connected.');
        }

        const request = this.pool.request();
        request.stream = true;

        // Readable's `read()` is only invoked when the consumer is ready for
        // more data, so it doubles as the resume signal; `push()` returning
        // false means the internal buffer is full and we must pause the
        // underlying mssql request until the consumer catches up.
        const readable = new Readable({
            objectMode: true,
            read() {
                request.resume();
            },
        });

        request.pause();

        request.on('row', (row: Record<string, unknown>) => {
            if (!readable.push(row)) {
                request.pause();
            }
        });

        request.on('error', (err: Error) => {
            readable.destroy(err);
        });

        request.on('done', () => {
            readable.push(null);
        });

        request.query(sqlText);

        return readable;
    }

    private async executeWithSqlClient(sqlText: string): Promise<QueryResult> {
        if (!this.config) {
            throw new Error('Database is not connected.');
        }

        const request = {
            connection: this.config,
            sql: sqlText,
        };

        const helperOutput = await this.runSqlClientHelper(
            JSON.stringify(request)
        );
        const parsed = JSON.parse(helperOutput) as QueryResult;

        return {
            rows: parsed.rows ?? [],
            rowCount: parsed.rowCount ?? 0,
        };
    }

    private runSqlClientHelper(input: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const helperProject = path.resolve(
                path.dirname(fileURLToPath(import.meta.url)),
                '..',
                '..',
                'tools',
                'sqlclient-helper',
                'SqlClientHelper.csproj'
            );

            const child = spawn(
                'dotnet',
                ['run', '--project', helperProject, '--configuration', 'Release', '--no-restore'],
                {
                    stdio: ['pipe', 'pipe', 'pipe'],
                }
            );

            let stdout = '';
            let stderr = '';

            child.stdout.on('data', (chunk: Buffer) => {
                stdout += chunk.toString('utf8');
            });

            child.stderr.on('data', (chunk: Buffer) => {
                stderr += chunk.toString('utf8');
            });

            child.on('error', (error) => {
                reject(error);
            });

            child.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout.trim());
                    return;
                }

                reject(
                    new Error(
                        stderr.trim() || stdout.trim() || `dotnet exited with code ${code ?? 1}`
                    )
                );
            });

            child.stdin.write(input);
            child.stdin.end();
        });
    }
}

ProviderRegistry.register('sqlserver', SqlServerProvider);
