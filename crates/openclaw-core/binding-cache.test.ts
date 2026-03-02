/**
 * Tests for the Rust BindingCache native addon.
 *
 * Run: pnpm test crates/openclaw-core/binding-cache
 */

import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";

const req = createRequire(import.meta.url);
const addonDir = resolve(import.meta.dirname ?? __dirname, ".");

// Detect whether the native addon has been built. If not, skip all tests
// gracefully — do NOT call process.exit(), which would kill the whole runner.
// To build: `cargo build -p openclaw-core` then copy the .node file.
const addonBuilt = (() => {
  try {
    req(resolve(addonDir, "index.js"));
    return true;
  } catch {
    return false;
  }
})();

const describeIfBuilt = addonBuilt ? describe : describe.skip;

// Lazily loaded only when addonBuilt is true.
const native = addonBuilt ? req(resolve(addonDir, "index.js")) : null;

type NativeBindingCache = {
  get(channel: string, accountId: string): string | null;
  set(channel: string, accountId: string, value: string): void;
  invalidate(): void;
  readonly size: number;
  readonly capacity: number;
};

const BindingCache: new (capacity: number) => NativeBindingCache = native?.BindingCache;
const coreVersion: (() => string) | undefined = native?.coreVersion;

describeIfBuilt("coreVersion", () => {
  it("returns a semver string", () => {
    const v = coreVersion!();
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describeIfBuilt("BindingCache", () => {
  let cache: NativeBindingCache;

  beforeEach(() => {
    cache = new BindingCache(5);
  });

  it("starts empty", () => {
    expect(cache.size).toBe(0);
    expect(cache.capacity).toBe(5);
  });

  it("returns null on miss", () => {
    expect(cache.get("telegram", "acc1")).toBeNull();
  });

  it("stores and retrieves a value", () => {
    const value = JSON.stringify([{ binding: "rule-1" }]);
    cache.set("telegram", "acc1", value);
    expect(cache.get("telegram", "acc1")).toBe(value);
    expect(cache.size).toBe(1);
  });

  it("distinguishes by channel", () => {
    cache.set("telegram", "acc1", "A");
    cache.set("discord", "acc1", "B");
    expect(cache.get("telegram", "acc1")).toBe("A");
    expect(cache.get("discord", "acc1")).toBe("B");
  });

  it("distinguishes by accountId", () => {
    cache.set("telegram", "acc1", "A");
    cache.set("telegram", "acc2", "B");
    expect(cache.get("telegram", "acc1")).toBe("A");
    expect(cache.get("telegram", "acc2")).toBe("B");
  });

  it("invalidate clears all entries", () => {
    cache.set("telegram", "acc1", "A");
    cache.set("discord", "acc2", "B");
    cache.invalidate();
    expect(cache.size).toBe(0);
    expect(cache.get("telegram", "acc1")).toBeNull();
  });

  it("evicts LRU entry when capacity is exceeded (not full-flush)", () => {
    // Fill cache to capacity (5 entries).
    for (let i = 0; i < 5; i++) {
      cache.set("ch", `acc${i}`, `val${i}`);
    }
    expect(cache.size).toBe(5);

    // Access acc0 to make it recently used.
    cache.get("ch", "acc0");

    // Insert a 6th entry — should evict acc1 (LRU), NOT clear everything.
    cache.set("ch", "acc5", "val5");
    expect(cache.size).toBe(5); // still at capacity, not 1

    // acc1 should be evicted (LRU); acc0 promoted so it stays.
    expect(cache.get("ch", "acc1")).toBeNull();
    expect(cache.get("ch", "acc0")).toBe("val0");
    expect(cache.get("ch", "acc5")).toBe("val5");
  });

  it("rejects capacity of 0", () => {
    expect(() => new BindingCache(0)).toThrow();
  });

  it("handles large payloads correctly", () => {
    const largeJson = JSON.stringify(
      Array.from({ length: 500 }, (_, i) => ({ id: i, rule: `binding-${i}` })),
    );
    cache.set("slack", "enterprise-123", largeJson);
    expect(cache.get("slack", "enterprise-123")).toBe(largeJson);
  });
});
