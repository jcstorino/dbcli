import { Readable } from 'node:stream';

import { ConnectionConfig } from '../types/ConnectionConfig.js';
import { QueryResult } from '../types/QueryResult.js';

export interface DatabaseProvider {
    connect(config: ConnectionConfig): Promise<void>;

    disconnect(): Promise<void>;

    execute(sql: string): Promise<QueryResult>;

    /**
     * Streams rows one at a time instead of buffering the whole recordset,
     * so exporting large tables does not require holding the entire result
     * set (and its serialized form) in memory at once.
     */
    streamQuery(sql: string): Readable;
}
