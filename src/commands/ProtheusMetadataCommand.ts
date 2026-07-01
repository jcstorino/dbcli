import { DatabaseService } from '../core/DatabaseService.js';
import { OutputFormat, ResultRenderer } from '../core/ResultRenderer.js';

interface ProtheusMetadataCommandOptions {
    format: OutputFormat;
    out?: string;
    maxRows?: number;
}

export class ProtheusMetadataCommand {
    public async execute(
        connectionName: string,
        tableName: string,
        options: ProtheusMetadataCommandOptions
    ): Promise<void> {
        const service = DatabaseService.create(connectionName);
        const result = await service.getProtheusMetadata(tableName);

        ResultRenderer.render(result, {
            format: options.format,
            out: options.out,
            maxRows: options.maxRows,
        });
    }
}
