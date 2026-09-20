import { SearchEngineProvider } from "./provider.js";
import { QueryEngineType } from "./types.js";

class ProviderRegistry {
  private providers: Map<QueryEngineType, SearchEngineProvider> = new Map();

  register(provider: SearchEngineProvider): void {
    this.providers.set(provider.engine, provider);
  }

  get(engine: QueryEngineType): SearchEngineProvider | undefined {
    return this.providers.get(engine);
  }

  getAll(): SearchEngineProvider[] {
    return Array.from(this.providers.values());
  }

  getConfigured(): SearchEngineProvider[] {
    return this.getAll().filter((p) => p.isConfigured());
  }
}

export const registry = new ProviderRegistry();
