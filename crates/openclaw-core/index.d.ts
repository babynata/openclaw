/**
 * @openclaw/core-native — Rust native addon type declarations.
 * These types are hand-authored to match the #[napi] exports in src/lib.rs.
 * When adding new exports, update both lib.rs and this file.
 */

/**
 * LRU cache for evaluated route bindings.
 *
 * Values are opaque JSON strings. TypeScript callers are responsible for
 * JSON.stringify / JSON.parse; Rust only manages eviction.
 *
 * Replace the `byChannelAccount: Map` + clear-on-overflow pattern in
 * `resolve-route.ts` with this class to get proper LRU eviction.
 */
export declare class BindingCache {
  /**
   * @param capacity Maximum number of (channel, accountId) entries.
   *   When capacity is reached, the least-recently-used entry is evicted.
   *   Must be > 0.
   */
  constructor(capacity: number): BindingCache;

  /** Returns the cached JSON string, or null on cache miss. */
  get(channel: string, accountId: string): string | null;

  /** Stores a JSON string. Evicts LRU entry if over capacity. */
  set(channel: string, accountId: string, value: string): void;

  /**
   * Clears all entries. Call when the bindings config reference changes
   * so stale evaluations are not returned.
   */
  invalidate(): void;

  /** Current number of cached entries. */
  readonly size: number;

  /** Configured maximum capacity. */
  readonly capacity: number;
}

/** Returns the crate version (e.g. "0.1.0"). Used in tests to verify load. */
export declare function coreVersion(): string;
