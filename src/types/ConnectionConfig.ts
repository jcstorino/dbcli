export type DatabaseProviderType =
    | 'sqlserver'
    | 'oracle';

export type SqlServerAuthenticationMode =
    | 'sql'
    | 'windows'
    | 'ntlm';

export interface ConnectionConfig {
    name: string;
    provider: DatabaseProviderType;
    server: string;
    port?: number;
    database: string;
    authentication?: SqlServerAuthenticationMode;
    username?: string;
    password?: string;
    domain?: string;
    encrypt?: boolean;
    trustServerCertificate?: boolean;
}
