import { ConnectionConfig } from '../types/ConnectionConfig.js';
import { QueryResult } from '../types/QueryResult.js';

export interface DatabaseProvider {
    connect(config: ConnectionConfig): Promise<void>;

    disconnect(): Promise<void>;

    execute(sql: string): Promise<QueryResult>;
}
