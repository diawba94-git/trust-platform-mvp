import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomSaltHex, sha256Hex } from "./cryptoService";

/**
 * PIN applicatif à 4-6 chiffres, indépendant du verrouillage biométrique du Keychain
 * (LockScreen.tsx exige les deux : le Keychain protège la clé privée, le PIN protège
 * l'ouverture de l'app elle-même — utile sur un appareil où la biométrie est partagée).
 * Seul le hash salé (SHA-256) est stocké, jamais le PIN en clair — AsyncStorage (non chiffré
 * au repos, contrairement à react-native-encrypted-storage) est donc un choix acceptable ici,
 * fait pour permettre le test dans Expo Go (cf. docs/WALLET.md).
 */

const PIN_HASH_KEY = "trustwedge.wallet.pin_hash";
const PIN_SALT_KEY = "trustwedge.wallet.pin_salt";

export async function setPin(pin: string): Promise<void> {
  const salt = await randomSaltHex();
  const hash = sha256Hex(`${salt}:${pin}`);
  await AsyncStorage.setItem(PIN_SALT_KEY, salt);
  await AsyncStorage.setItem(PIN_HASH_KEY, hash);
}

export async function hasPin(): Promise<boolean> {
  const hash = await AsyncStorage.getItem(PIN_HASH_KEY);
  return !!hash;
}

export async function verifyPin(pin: string): Promise<boolean> {
  const salt = await AsyncStorage.getItem(PIN_SALT_KEY);
  const expectedHash = await AsyncStorage.getItem(PIN_HASH_KEY);
  if (!salt || !expectedHash) return false;
  return sha256Hex(`${salt}:${pin}`) === expectedHash;
}

export async function clearPin(): Promise<void> {
  await AsyncStorage.removeItem(PIN_HASH_KEY);
  await AsyncStorage.removeItem(PIN_SALT_KEY);
}
