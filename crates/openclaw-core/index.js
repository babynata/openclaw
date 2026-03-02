// Loader for the napi-rs native addon.
// Tries the pre-built platform binary first; falls back to local build output.
// This file is generated/maintained manually since we're not using napi-rs CLI scaffolding.

"use strict";

const { existsSync } = require("fs");
const { join } = require("path");

const platformTriple = (() => {
  const { platform } = process;
  // process.arch reflects the Node.js binary arch (may differ from OS arch under Rosetta 2).
  // Use os.arch() to get the actual machine arch when available.
  let arch = process.arch;
  try {
    arch = require("os").arch();
  } catch {
    /* ignore */
  }
  if (platform === "darwin") {
    return arch === "arm64" ? "darwin-arm64" : "darwin-x64";
  }
  if (platform === "linux") {
    return arch === "arm64" ? "linux-arm64-gnu" : "linux-x64-gnu";
  }
  if (platform === "win32") {
    return "win32-x64-msvc";
  }
  return null;
})();

function tryLoad(addonPath) {
  if (existsSync(addonPath)) {
    return require(addonPath);
  }
  return null;
}

// 1. Try the local build output (cargo builds here by default)
const localAddon = join(__dirname, `openclaw-core.${platformTriple}.node`);

// 2. Try platform-specific npm package
const npmAddon = platformTriple
  ? (() => {
      try {
        return require(`@openclaw/core-native-${platformTriple}`);
      } catch {
        return null;
      }
    })()
  : null;

const native = tryLoad(localAddon) ?? npmAddon;

if (!native) {
  throw new Error(
    `@openclaw/core-native: no prebuilt binary found for ${process.platform}/${process.arch}. ` +
      `Run \`cargo build -p openclaw-core\` or install the matching npm platform package.`,
  );
}

module.exports = native;
