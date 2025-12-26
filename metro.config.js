// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure Metro can resolve the @ alias properly
config.resolver.extraNodeModules = {
  '@': path.resolve(__dirname),
};

// Add file extensions support
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
