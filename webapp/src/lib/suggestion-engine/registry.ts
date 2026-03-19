import type { PromptProvider } from "./types";

export class PromptProviderRegistry {
  private providers = new Map<string, PromptProvider>();

  register(provider: PromptProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(id: string): boolean {
    return this.providers.delete(id);
  }

  getAll(): PromptProvider[] {
    return Array.from(this.providers.values());
  }

  get(id: string): PromptProvider | undefined {
    return this.providers.get(id);
  }

  get size(): number {
    return this.providers.size;
  }
}
