// openclaw-core: Rust native addon for performance-critical paths.
// Loaded by Node.js via napi-rs; all public symbols use #[napi] macro.

#![deny(clippy::all)]

use napi_derive::napi;

mod binding_cache;

pub use binding_cache::BindingCache;

/// Sanity-check export: returns the crate version string.
/// Used in tests to verify the addon loads correctly.
#[napi]
pub fn core_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
