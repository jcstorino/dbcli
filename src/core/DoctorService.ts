import dns from 'node:dns/promises';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { ConfigLoader } from '../config/ConfigLoader.js';
import { DatabaseService } from './DatabaseService.js';
import { QueryResult } from '../types/QueryResult.js';

const execFileAsync = promisify(execFile);

interface DoctorRow extends Record<string, unknown> {
    category: string;
    check: string;
    status: 'ok' | 'warn' | 'fail';
    details: string;
}

export class DoctorService {
    public async run(connectionName: string): Promise<QueryResult> {
        const config = ConfigLoader.load(connectionName);
        const rows: DoctorRow[] = [];

        rows.push({
            category: 'config',
            check: 'connection',
            status: 'ok',
            details: `name=${config.name}; auth=${config.authentication ?? 'sql'}; server=${config.server}; database=${config.database}`,
        });

        rows.push({
            category: 'config',
            check: 'config-file',
            status: 'ok',
            details: ConfigLoader.resolvePath(),
        });

        await this.checkDns(config.server, rows);
        await this.checkPort(config.server, config.port ?? 1433, rows);

        if ((config.authentication ?? 'sql') === 'windows') {
            await this.checkKerberos(rows);
            await this.checkDotnet(rows);
        }

        await this.checkConnection(connectionName, rows);

        return {
            rows,
            rowCount: rows.length,
        };
    }

    private async checkDns(server: string, rows: DoctorRow[]): Promise<void> {
        try {
            const result = await dns.lookup(server);
            rows.push({
                category: 'network',
                check: 'dns',
                status: 'ok',
                details: `${server} -> ${result.address}`,
            });
        } catch (error) {
            rows.push({
                category: 'network',
                check: 'dns',
                status: 'fail',
                details: this.toMessage(error),
            });
        }
    }

    private async checkPort(
        server: string,
        port: number,
        rows: DoctorRow[]
    ): Promise<void> {
        try {
            await new Promise<void>((resolve, reject) => {
                const socket = net.createConnection({ host: server, port, timeout: 5000 });

                socket.once('connect', () => {
                    socket.destroy();
                    resolve();
                });

                socket.once('timeout', () => {
                    socket.destroy();
                    reject(new Error('timeout'));
                });

                socket.once('error', reject);
            });

            rows.push({
                category: 'network',
                check: 'tcp-port',
                status: 'ok',
                details: `${server}:${port}`,
            });
        } catch (error) {
            rows.push({
                category: 'network',
                check: 'tcp-port',
                status: 'fail',
                details: this.toMessage(error),
            });
        }
    }

    private async checkKerberos(rows: DoctorRow[]): Promise<void> {
        try {
            const { stdout } = await execFileAsync('klist', [], { timeout: 5000 });
            const principal = stdout.match(/Principal:\s+([^\n]+)/)?.[1]?.trim();
            rows.push({
                category: 'kerberos',
                check: 'ticket-cache',
                status: principal ? 'ok' : 'warn',
                details: principal ?? 'ticket cache found, principal not parsed',
            });
        } catch (error) {
            rows.push({
                category: 'kerberos',
                check: 'ticket-cache',
                status: 'fail',
                details: this.toMessage(error),
            });
        }
    }

    private async checkDotnet(rows: DoctorRow[]): Promise<void> {
        try {
            const { stdout } = await execFileAsync('dotnet', ['--version'], { timeout: 10000 });
            rows.push({
                category: 'runtime',
                check: 'dotnet',
                status: 'ok',
                details: stdout.trim(),
            });
        } catch (error) {
            rows.push({
                category: 'runtime',
                check: 'dotnet',
                status: 'fail',
                details: this.toMessage(error),
            });
        }
    }

    private async checkConnection(
        connectionName: string,
        rows: DoctorRow[]
    ): Promise<void> {
        try {
            const service = DatabaseService.create(connectionName);
            await service.testConnection();
            rows.push({
                category: 'database',
                check: 'login',
                status: 'ok',
                details: 'connection successful',
            });
        } catch (error) {
            rows.push({
                category: 'database',
                check: 'login',
                status: 'fail',
                details: this.toMessage(error),
            });
        }
    }

    private toMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }

        return String(error);
    }
}
