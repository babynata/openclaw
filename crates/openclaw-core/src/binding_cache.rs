// LRU cache for evaluated route bindings.
//
// TypeScript's original implementation (`resolve-route.ts`) used a plain Map
// that hard-flushed *all* entries once the size exceeded MAX_EVALUATED_BINDINGS_CACHE_KEYS.
// This Rust implementation replaces that with proper LRU eviction so hot entries
// are never evicted while cold ones are pruned.
//
// The values stored are opaque JSON strings; serialization/deserialization stays
// in TypeScript so Rust doesn't need to understand EvaluatedBinding's schema.
//
// Thread safety: napi-rs exposes JS objects on a single thread but async tasks
// can run on other threads; Mutex keeps the inner LRU safe across both cases.

use std::sync::Mutex;

use lru::LruCache;
use napi_derive::napi;

/// One LRU cache instance, typically shared per OpenClawConfig lifetime.
/// Create a new instance (or call `invalidate`) when the bindings reference changes.
#[napi]
pub struct BindingCache {
    inner: Mutex<LruCache<(String, String), String>>,
}

#[napi]
impl BindingCache {
    /// `capacity`: maximum number of (channel, accountId) entries to keep.
    /// Evicts the least-recently-used entry when the limit is reached.
    #[napi(constructor)]
    pub fn new(capacity: u32) -> napi::Result<Self> {
        let cap = std::num::NonZeroUsize::new(capacity as usize)
            .ok_or_else(|| napi::Error::from_reason("BindingCache capacity must be > 0"))?;
        Ok(Self {
            inner: Mutex::new(LruCache::new(cap)),
        })
    }

    /// Returns the cached JSON string for (channel, accountId), or null on miss.
    #[napi]
    pub fn get(&self, channel: String, account_id: String) -> napi::Result<Option<String>> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| napi::Error::from_reason("BindingCache mutex poisoned"))?;
        // `get` updates the LRU order (promotes the entry to most-recently-used).
        Ok(guard.get(&(channel, account_id)).cloned())
    }

    /// Stores a JSON string for (channel, accountId).
    /// If capacity is exceeded, the least-recently-used entry is evicted automatically.
    #[napi]
    pub fn set(&self, channel: String, account_id: String, value: String) -> napi::Result<()> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| napi::Error::from_reason("BindingCache mutex poisoned"))?;
        guard.put((channel, account_id), value);
        Ok(())
    }

    /// Drops all cached entries. Call this when `cfg.bindings` reference changes.
    #[napi]
    pub fn invalidate(&self) -> napi::Result<()> {
        let mut guard = self
            .inner
            .lock()
            .map_err(|_| napi::Error::from_reason("BindingCache mutex poisoned"))?;
        guard.clear();
        Ok(())
    }

    /// Current number of cached entries.
    #[napi(getter)]
    pub fn size(&self) -> napi::Result<u32> {
        let guard = self
            .inner
            .lock()
            .map_err(|_| napi::Error::from_reason("BindingCache mutex poisoned"))?;
        Ok(guard.len() as u32)
    }

    /// Configured maximum capacity.
    #[napi(getter)]
    pub fn capacity(&self) -> napi::Result<u32> {
        let guard = self
            .inner
            .lock()
            .map_err(|_| napi::Error::from_reason("BindingCache mutex poisoned"))?;
        Ok(guard.cap().get() as u32)
    }
}
