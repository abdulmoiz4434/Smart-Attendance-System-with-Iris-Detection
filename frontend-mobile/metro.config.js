const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// ── Bundle size optimisations ──────────────────────────────────────────────
// Inline requires: defer module evaluation until first use → smaller initial
// parse time and smaller effective bundle on cold start.
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    // Terser options — strip dead code, mangle names, drop console.*
    compress: {
      drop_console: true,       // removes all console.log/warn/error calls
      dead_code: true,
      passes: 2,                // two compression passes for extra savings
    },
    mangle: {
      toplevel: true,
    },
  },
};

// Tree-shake: only resolve the CJS/ESM variant that actually ships less code.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;