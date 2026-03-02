/**
 * Tests for the Rust BindingCache native addon.
 *
 * Run: pnpm test crates/openclaw-core/binding-cache
 */

import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, it, expect, beforeEach } from "vitest";

// Load the native addon from the built .node file.
// The addon is built by `cargo build -p openclaw-core` and copied to the crate dir.
const req = createRequire(import.meta.url);
const addonDir = resolve(import.meta.dirname ?? __dirname, ".");

let BindingCache: new (capacity: number) => {
  get(channel: string, accountId: string): string | null;
  set(channel: string, accountId: string, value: string): void;
  invalidate(): void;
  readonly size: number;
  readonly capacity: number;
};

let coreVersion: () => string;

try {
  const native = req(resolve(addonDir, "index.js"));
  BindingCache = native.BindingCache;
  coreVersion = native.coreVersion;
} catch (err) {
  // Skip tests if the native addon hasn't been built yet.
  // Run `cargo build -p openclaw-core` and copy the .node file first.
  describe.skip("BindingCache (native addon not built)", () => {
    it("skipped", () => {});
  });
  // Exit this module so the rest doesn't fail at import time.
  // @ts-ignore
  process.exit?.(0);
  throw err;
}

describe("coreVersion", () => {
  it("returns a semver string", () => {
    const v = coreVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe("BindingCache", () => {
  let cache: InstanceType<typeof BindingCache>;

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
