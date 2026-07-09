type CacheEntry<T> = {
  expiresAt: number;
  value?: T;
  promise?: Promise<T>;
};

export class TtlCache<T> {
  private entries = new Map<string, CacheEntry<T>>();

  constructor(private ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= Date.now() || entry.value === undefined) {
      return undefined;
    }

    return entry.value;
  }

  async getOrSet(key: string, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const entry = this.entries.get(key);

    if (entry && entry.expiresAt > now) {
      if (entry.value !== undefined) return entry.value;
      if (entry.promise) return entry.promise;
    }

    const promise = loader()
      .then((value) => {
        this.entries.set(key, {
          expiresAt: Date.now() + this.ttlMs,
          value,
        });
        return value;
      })
      .catch((error) => {
        this.entries.delete(key);
        throw error;
      });

    this.entries.set(key, {
      expiresAt: now + this.ttlMs,
      promise,
    });

    return promise;
  }

  set(key: string, value: T) {
    this.entries.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    });
  }

  delete(key: string) {
    this.entries.delete(key);
  }

  deletePrefix(prefix: string) {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }
}

export function hashCacheKey(value: string): string {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}
