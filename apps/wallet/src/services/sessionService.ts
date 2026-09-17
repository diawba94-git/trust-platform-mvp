import AsyncStorage from "@react-native-async-storage/async-storage";
import { getOrCreateMasterKey } from "./keyService";
import { aesDecryptFromBase64, aesEncryptToBase64 } from "./cryptoService";

/**
 * JWT de session (émis par POST /auth/login, cf. services/backend/app/auth.py). Le backend
 * n'a pas de refresh token — JWT_EXPIRATION vaut 3600s par défaut (.env) : passé ce délai,
 * getValidToken() renvoie null et l'app doit redemander email/mot de passe (LoginScreen).
 * Le token n'est utile que pour l'appel ponctuel à /did/my et /documents/my ; le wallet ne
 * dépend pas d'une session permanente pour fonctionner (les données sont mises en cache).
 * Chiffré avec la même clé maîtresse AES-256 que le reste du cache (cf. storageService.ts) —
 * AsyncStorage seul n'est pas chiffré au repos, contrairement à react-native-encrypted-storage.
 */

const SESSION_KEY = "trustwedge.wallet.session";

interface StoredSession {
  token: string;
  expiresAt: number; // epoch ms
}

export async function saveSession(token: string, expiresInSeconds: number): Promise<void> {
  const session: StoredSession = {
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  const masterKey = await getOrCreateMasterKey();
  const encrypted = aesEncryptToBase64(JSON.stringify(session), masterKey);
  await AsyncStorage.setItem(SESSION_KEY, encrypted);
}

export async function getValidToken(): Promise<string | null> {
  const encrypted = await AsyncStorage.getItem(SESSION_KEY);
  if (!encrypted) return null;
  const masterKey = await getOrCreateMasterKey();
  const session = JSON.parse(aesDecryptFromBase64(encrypted, masterKey)) as StoredSession;
  if (Date.now() >= session.expiresAt) return null;
  return session.token;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}
