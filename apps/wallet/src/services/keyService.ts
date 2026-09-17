import * as SecureStore from "expo-secure-store";
import { generateAes256KeyHex } from "./cryptoService";

/**
 * Stockage des secrets via expo-secure-store (Keychain iOS / Keystore Android) :
 *  - la clé privée du DID de l'utilisateur (obtenue une fois via GET /did/my, cf. authService)
 *  - la clé maîtresse AES-256 utilisée pour chiffrer le cache local (documents, PDFs)
 *
 * `requireAuthentication: true` fait demander Face ID / empreinte / code de l'appareil par
 * l'OS à chaque lecture — en plus du PIN applicatif (pinService.ts), qui protège l'accès à
 * l'app elle-même. Deux facteurs indépendants, comme demandé ("Keychain + PIN").
 *
 * ⚠️ Choix fait pour pouvoir tester dans Expo Go (voir docs/WALLET.md) : react-native-keychain
 * offre un contrôle plus fin (ex. AES_GCM explicite, accessible only-this-device) mais impose
 * un dev client. expo-secure-store est adossé au même stockage OS sécurisé — un compromis
 * raisonnable pour du test, à reconsidérer si un vrai build natif est repris plus tard.
 */

const PRIVATE_KEY_ITEM = "trustwedge_wallet_private_key";
const MASTER_KEY_ITEM = "trustwedge_wallet_master_key";

const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
  requireAuthentication: true,
};

export async function storePrivateKey(did: string, privateKey: string): Promise<void> {
  await SecureStore.setItemAsync(PRIVATE_KEY_ITEM, JSON.stringify({ did, privateKey }), SECURE_OPTIONS);
}

export async function getPrivateKey(): Promise<{ did: string; privateKey: string } | null> {
  const raw = await SecureStore.getItemAsync(PRIVATE_KEY_ITEM, SECURE_OPTIONS);
  if (!raw) return null;
  return JSON.parse(raw) as { did: string; privateKey: string };
}

export async function hasPrivateKey(): Promise<boolean> {
  // Lire sans exiger l'authentification ici : on veut juste savoir si un wallet est déjà lié
  // (bootstrap de navigation), pas déverrouiller quoi que ce soit.
  const raw = await SecureStore.getItemAsync(PRIVATE_KEY_ITEM, { keychainAccessible: SecureStore.WHEN_UNLOCKED });
  return !!raw;
}

export async function clearPrivateKey(): Promise<void> {
  await SecureStore.deleteItemAsync(PRIVATE_KEY_ITEM);
}

/** Clé maîtresse AES-256 pour storageService — générée une fois, jamais transmise au réseau. */
export async function getOrCreateMasterKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(MASTER_KEY_ITEM, { keychainAccessible: SecureStore.WHEN_UNLOCKED });
  if (existing) return existing;

  const key = await generateAes256KeyHex();
  await SecureStore.setItemAsync(MASTER_KEY_ITEM, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED });
  return key;
}

export async function clearMasterKey(): Promise<void> {
  await SecureStore.deleteItemAsync(MASTER_KEY_ITEM);
}
