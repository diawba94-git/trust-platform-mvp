import { Wallet } from "ethers";
import type { WalletIdentity } from "@trustwedge/shared";
import { apiClient } from "./sdk";
import { saveSession, clearSession } from "./sessionService";
import { storePrivateKey, clearPrivateKey, clearMasterKey, hasPrivateKey } from "./keyService";
import { saveIdentity, getIdentity, clearAllLocalData } from "./storageService";
import { clearPin } from "./pinService";
import { generatePrivateKeyHex } from "./cryptoService";

// Doit rester alignée avec JWT_EXPIRATION dans .env (backend) — le token n'est de toute
// façon utile qu'à l'onboarding et lors d'une synchronisation manuelle (cf. sessionService.ts).
const ASSUMED_JWT_TTL_SECONDS = 3600;

/**
 * Rattache le wallet à un compte TrustWedge existant : se connecte avec email/mot de passe
 * (POST /auth/login), récupère le DID + la clé privée déjà générés côté backend pour ce
 * compte (GET /did/my) puis les enferme dans le Keychain — la clé privée ne quitte plus
 * jamais l'appareil après cette étape. C'est ce qui permet de partir des identités
 * TrustWedge existantes (comme demandé) plutôt que de générer un DID orphelin.
 */
export async function linkExistingAccount(email: string, password: string): Promise<WalletIdentity> {
  const tokenResponse = await apiClient.login(email, password);
  await saveSession(tokenResponse.access_token, ASSUMED_JWT_TTL_SECONDS);

  const credentials = await apiClient.getMyCredentials();
  if (!credentials.private_key) {
    throw new Error("Aucune clé privée disponible pour ce compte — contactez un administrateur.");
  }

  await storePrivateKey(credentials.did, credentials.private_key);

  const identity: WalletIdentity = {
    did: credentials.did,
    address: credentials.address,
    publicKey: credentials.public_key,
    fullName: credentials.full_name,
    email: credentials.email,
    role: credentials.role,
    linkedAt: new Date().toISOString(),
  };
  await saveIdentity(identity);
  return identity;
}

/**
 * Crée un tout nouveau DID, localement : pour quelqu'un qui n'a aucun compte TrustWedge
 * préexistant (ex: un acheteur qui veut juste pouvoir recevoir/vérifier un titre, jamais
 * provisionné par un admin). La paire de clés est générée sur l'appareil et n'en sort
 * jamais — seule l'adresse publique est envoyée au serveur, via POST /auth/register (public,
 * n'exige aucun rôle admin). Contrairement à linkExistingAccount(), le backend ne détient
 * donc à aucun moment cette clé privée : c'est le chemin réellement auto-souverain.
 *
 * Un DID créé ainsi peut recevoir des documents normalement — le contrat n'exige pas que
 * `owner` corresponde à un compte préexistant — mais n'a aucun rôle on-chain particulier
 * (ISSUER/VERIFIER/NOTARY) : il ne peut qu'être propriétaire et vérifier, pas émettre.
 */
export async function registerNewAccount(
  email: string,
  password: string,
  fullName: string
): Promise<WalletIdentity> {
  const wallet = new Wallet(await generatePrivateKeyHex());

  const user = await apiClient.register({
    email,
    password,
    full_name: fullName,
    role: "USER",
    address: wallet.address,
  });

  await storePrivateKey(user.did, wallet.privateKey);

  // Établit une session tout de suite (pratique pour une synchro immédiate) — non bloquant :
  // la clé est déjà sur l'appareil quoi qu'il arrive, une connexion ultérieure suffira sinon.
  try {
    const tokenResponse = await apiClient.login(email, password);
    await saveSession(tokenResponse.access_token, ASSUMED_JWT_TTL_SECONDS);
  } catch {
    // ignoré volontairement
  }

  const identity: WalletIdentity = {
    did: user.did,
    address: user.address ?? wallet.address,
    publicKey: wallet.publicKey,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    linkedAt: new Date().toISOString(),
  };
  await saveIdentity(identity);
  return identity;
}

export async function getLinkedIdentity(): Promise<WalletIdentity | null> {
  return getIdentity();
}

export async function isWalletLinked(): Promise<boolean> {
  return hasPrivateKey();
}

/** Déconnexion complète : efface la clé privée, la clé maîtresse et tout le cache local. */
export async function unlinkWallet(): Promise<void> {
  await clearPrivateKey();
  await clearMasterKey();
  await clearAllLocalData();
  await clearSession();
  await clearPin();
}
