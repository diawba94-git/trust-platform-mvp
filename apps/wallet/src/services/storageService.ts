import AsyncStorage from "@react-native-async-storage/async-storage";
// Depuis SDK 54, l'entrée principale d'expo-file-system n'expose plus l'ancienne API
// fonctionnelle (documentDirectory, writeAsStringAsync, ...) — remplacée par les classes
// File/Directory. Les anciennes fonctions existent toujours mais lèvent explicitement une
// exception à l'exécution ("This method will throw in runtime", cf. legacyWarnings.ts) pour
// forcer la migration. Le sous-module /legacy fournit l'ancienne API intacte, en attendant une
// migration complète vers la nouvelle.
import * as FileSystem from "expo-file-system/legacy";
import type { CachedDocument, WalletIdentity } from "@trustwedge/shared";
import { getOrCreateMasterKey } from "./keyService";
import { aesDecryptFromBase64, aesEncryptToBase64, arrayBufferToBase64 } from "./cryptoService";

/**
 * Cache local chiffré des attestations et de l'identité liée.
 *  - Index + identité : AsyncStorage, chiffré AES-256 applicatif (clé maîtresse dans le
 *    SecureStore/Keychain, cf. keyService.ts) — AsyncStorage seul n'est pas chiffré au repos,
 *    d'où l'importance de ce chiffrement applicatif ici.
 *  - PDFs : écrits sur disque (répertoire privé de l'app) chiffrés AES-256, déchiffrés à la
 *    volée uniquement pour l'affichage/le partage (cf. documentService.getDocumentPdfUri).
 */

const IDENTITY_KEY = "trustwedge.wallet.identity";
const DOCUMENTS_INDEX_KEY = "trustwedge.wallet.documents_index";
const PDF_DIR = `${FileSystem.documentDirectory}trustwedge-pdfs/`;

async function ensurePdfDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PDF_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PDF_DIR, { intermediates: true });
  }
}

// ------------------------------------------------------------
// Identité
// ------------------------------------------------------------
export async function saveIdentity(identity: WalletIdentity): Promise<void> {
  const masterKey = await getOrCreateMasterKey();
  const encrypted = aesEncryptToBase64(JSON.stringify(identity), masterKey);
  await AsyncStorage.setItem(IDENTITY_KEY, encrypted);
}

export async function getIdentity(): Promise<WalletIdentity | null> {
  const encrypted = await AsyncStorage.getItem(IDENTITY_KEY);
  if (!encrypted) return null;
  const masterKey = await getOrCreateMasterKey();
  const json = aesDecryptFromBase64(encrypted, masterKey);
  return JSON.parse(json) as WalletIdentity;
}

// ------------------------------------------------------------
// Index des attestations
// ------------------------------------------------------------
export async function getDocumentsIndex(): Promise<CachedDocument[]> {
  const encrypted = await AsyncStorage.getItem(DOCUMENTS_INDEX_KEY);
  if (!encrypted) return [];
  const masterKey = await getOrCreateMasterKey();
  const json = aesDecryptFromBase64(encrypted, masterKey);
  return JSON.parse(json) as CachedDocument[];
}

export async function saveDocumentsIndex(documents: CachedDocument[]): Promise<void> {
  const masterKey = await getOrCreateMasterKey();
  const encrypted = aesEncryptToBase64(JSON.stringify(documents), masterKey);
  await AsyncStorage.setItem(DOCUMENTS_INDEX_KEY, encrypted);
}

export async function upsertDocument(doc: CachedDocument): Promise<void> {
  const index = await getDocumentsIndex();
  const next = index.filter((d) => d.tokenId !== doc.tokenId);
  next.push(doc);
  await saveDocumentsIndex(next);
}

// ------------------------------------------------------------
// PDFs (chiffrés sur disque)
// ------------------------------------------------------------
function pdfPath(tokenId: number): string {
  return `${PDF_DIR}${tokenId}.pdf.enc`;
}

export async function savePdfForDocument(tokenId: number, pdfBytes: ArrayBuffer): Promise<void> {
  await ensurePdfDir();
  const masterKey = await getOrCreateMasterKey();
  const base64Pdf = arrayBufferToBase64(pdfBytes);
  const encrypted = aesEncryptToBase64(base64Pdf, masterKey);
  await FileSystem.writeAsStringAsync(pdfPath(tokenId), encrypted, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function hasPdfForDocument(tokenId: number): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(pdfPath(tokenId));
  return info.exists;
}

/** Déchiffre le PDF en mémoire et l'écrit temporairement en clair dans le cache, pour lecture/partage. */
export async function getDecryptedPdfUri(tokenId: number): Promise<string | null> {
  const info = await FileSystem.getInfoAsync(pdfPath(tokenId));
  if (!info.exists) return null;

  const masterKey = await getOrCreateMasterKey();
  const encrypted = await FileSystem.readAsStringAsync(pdfPath(tokenId), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const base64Pdf = aesDecryptFromBase64(encrypted, masterKey);

  const tempUri = `${FileSystem.cacheDirectory}trustwedge-${tokenId}-${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(tempUri, base64Pdf, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return tempUri;
}

// ------------------------------------------------------------
// Réinitialisation (déconnexion / changement d'appareil)
// ------------------------------------------------------------
export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.removeItem(IDENTITY_KEY);
  await AsyncStorage.removeItem(DOCUMENTS_INDEX_KEY);
  const info = await FileSystem.getInfoAsync(PDF_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(PDF_DIR, { idempotent: true });
  }
}
