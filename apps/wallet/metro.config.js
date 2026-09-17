// Config Metro pour un monorepo npm workspaces. Depuis SDK 52+, expo/metro-config détecte
// et gère nativement les workspaces npm/yarn/pnpm (watchFolders + nodeModulesPaths
// automatiques) — les overrides manuels utilisés jusqu'à SDK 51 sont redondants et, pire,
// entrent en conflit avec cette détection (le point d'entrée se résolvait à la racine du
// monorepo au lieu de apps/wallet). Laisser expo/metro-config gérer ça seul.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

module.exports = config;
