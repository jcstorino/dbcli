import { ConnectionConfig } from '../types/ConnectionConfig.js';
import { DatabaseProvider } from './DatabaseProvider.js';

export type ProviderConstructor = new () => DatabaseProvider;

export class ProviderRegistry {
    private static readonly providers = new Map<string, ProviderConstructor>();

    public static register(
        provider: string,
        constructor: ProviderConstructor
    ): void {
        this.providers.set(provider.toLowerCase(), constructor);
    }

    public static create(config: ConnectionConfig): DatabaseProvider {
        const constructor = this.providers.get(config.provider.toLowerCase());

        if (!constructor) {
            throw new Error(`Provider '${config.provider}' is not registered.`);
        }

        return new constructor();
    }
}
