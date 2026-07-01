export type DatabaseProviderType =
    | 'sqlserver'
    | 'oracle';

export interface ConnectionConfig {
    name: string;
    provider: DatabaseProviderType;
    server: string;
    port?: number;
    database: string;
    username: string;
    password: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
}
