import * as ExpoCrypto from "expo-crypto";
import CryptoJS from "crypto-js";

/**
 * Chiffrement applicatif AES-256-CBC des données mises en cache localement (index des
 * attestations + PDFs), en plus du chiffrement au repos déjà fourni par le Keychain/Keystore
 * (via react-native-keychain / react-native-encrypted-storage). La clé maîtresse elle-même
 * ne vit que dans le Keychain — jamais en clair sur le disque (cf. keyService.ts).
 */

export async function generateAes256KeyHex(): Promise<string> {
  const bytes = await ExpoCrypto.getRandomBytesAsync(32); // 256 bits
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Clé privée Ethereum (32 octets, préfixée "0x") via expo-crypto plutôt que
 * `ethers.Wallet.createRandom()` — ce dernier dépend de `crypto.getRandomValues`, absent en
 * React Native sans le polyfill natif `react-native-get-random-values` (incompatible Expo Go,
 * cf. docs/WALLET.md). expo-crypto est déjà utilisé ailleurs dans le wallet et fonctionne
 * dans Expo Go. Utilisation : `new ethers.Wallet(await generatePrivateKeyHex())`.
 */
export async function generatePrivateKeyHex(): Promise<string> {
  return `0x${await generateAes256KeyHex()}`;
}

function keyFromHex(keyHex: string): CryptoJS.lib.WordArray {
  return CryptoJS.enc.Hex.parse(keyHex);
}

/**
 * `CryptoJS.lib.WordArray.random()` tente `crypto.getRandomValues`/`crypto.randomBytes`
 * (Web/Node) pour générer ses octets — aucun des deux n'existe en React Native, donc cet
 * appel lève toujours "Native crypto module could not be used to get secure random number."
 * On génère plutôt les octets via expo-crypto (déjà utilisé ailleurs dans ce fichier, fonctionne
 * dans Expo Go) puis on les enveloppe dans un WordArray pour que crypto-js les consomme.
 */
function secureRandomWordArray(byteCount: number): CryptoJS.lib.WordArray {
  const bytes = ExpoCrypto.getRandomBytes(byteCount);
  return CryptoJS.lib.WordArray.create(bytes as unknown as number[], byteCount);
}

/** Retourne base64(iv || ciphertext). L'IV est aléatoire à chaque appel. */
export function aesEncryptToBase64(plainText: string, keyHex: string): string {
  const key = keyFromHex(keyHex);
  const iv = secureRandomWordArray(16);
  const encrypted = CryptoJS.AES.encrypt(plainText, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  const combined = iv.concat(encrypted.ciphertext);
  return CryptoJS.enc.Base64.stringify(combined);
}

export function aesDecryptFromBase64(payloadBase64: string, keyHex: string): string {
  const key = keyFromHex(keyHex);
  const combined = CryptoJS.enc.Base64.parse(payloadBase64);
  const iv = CryptoJS.lib.WordArray.create(combined.words.slice(0, 4), 16);
  const ciphertext = CryptoJS.lib.WordArray.create(combined.words.slice(4), combined.sigBytes - 16);
  const decrypted = CryptoJS.AES.decrypt({ ciphertext } as CryptoJS.lib.CipherParams, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/** Encode un ArrayBuffer (ex: PDF téléchargé) en base64 pour le chiffrer avec aesEncryptToBase64. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const wordArray = CryptoJS.lib.WordArray.create(bytes as unknown as number[]);
  return CryptoJS.enc.Base64.stringify(wordArray);
}

export function sha256Hex(text: string): string {
  return CryptoJS.SHA256(text).toString(CryptoJS.enc.Hex);
}

export async function randomSaltHex(bytes = 16): Promise<string> {
  const random = await ExpoCrypto.getRandomBytesAsync(bytes);
  return Array.from(random)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
