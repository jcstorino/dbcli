import { DatabaseService } from '../core/DatabaseService.js';

export class TestCommand {
    public async execute(connectionName: string): Promise<void> {
        const service = DatabaseService.create(connectionName);
        await service.testConnection();
        console.log('ok');
    }
}
