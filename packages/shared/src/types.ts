// Types partagés entre le wallet mobile et l'API TrustWedge.
// Champs et endpoints alignés sur services/backend/app/schemas.py et
// services/nodes/contrat/DocumentRegistry.sol — garder synchronisé en cas de changement côté backend.

export type UserRole = "ADMIN" | "ISSUER" | "VERIFIER" | "BANK" | "NOTARY" | "USER";

export type DocType =
  | "LAND_TITLE"
  | "DIPLOMA"
  | "EMPLOYMENT"
  | "ID_CARD"
  | "BIRTH_CERTIFICATE"
  | "RESIDENCE_CERTIFICATE"
  | string;

export type AttributeValueType = "string" | "uint256" | "address" | "date" | "boolean";

export interface DocumentAttribute {
  key: string;
  value: string;
  valueType: AttributeValueType;
}

// Réponse de POST /auth/login (schemas.TokenResponse)
export interface AuthUser {
  id: number;
  did: string;
  address: string | null;
  public_key: string | null;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// Réponse de GET /did/my (schemas.MyCredentialsResponse) — private_key n'est renvoyée
// qu'à l'utilisateur authentifié lui-même, jamais rediffusée depuis le wallet.
export interface MyCredentials {
  id: number;
  did: string;
  address: string;
  private_key: string | null;
  public_key: string | null;
  email: string;
  full_name: string;
  role: UserRole;
}

// Réponse de GET /documents/my (main.py get_my_documents)
export interface DocumentSummary {
  id: number;
  token_id: number;
  issuer: string; // nom si connu, sinon adresse (cf. backend)
  issuer_address: string;
  owner: string;
  doc_type: DocType;
  doc_key: string;
  ipfs_cid: string;
  is_active: boolean;
  is_transferable: boolean;
  attributes: DocumentAttribute[];
  created_at: string;
}

// Réponse de GET /documents/verify/{token_id} — lecture on-chain publique, sans auth.
export interface VerifyResult {
  isValid: boolean;
  issuerDid: string;
  issuer: string;
  owner: string;
  docType: DocType;
  docKey: string;
  ipfsCid: string;
  owner_name: string | null;
  issuer_name: string | null;
}

export interface DocumentVersionEntry {
  version_index: number;
  cid: string;
  owner: string;
  owner_name: string | null;
  timestamp: number;
  is_current: boolean;
}

// Réponse de GET /documents/{token_id}/versions
export interface DocumentHistory {
  token_id: number;
  doc_type: DocType;
  doc_key: string | null;
  current_owner: string;
  current_owner_name: string | null;
  current_owner_did: string | null;
  is_active: boolean;
  is_transferable: boolean;
  attributes: DocumentAttribute[];
  versions: DocumentVersionEntry[];
}

// Payload encodé dans le QR code généré par le wallet pour le partage d'une attestation.
// Volontairement minimal : seul `tokenId` fait foi, tout le reste n'est qu'un indice
// d'affichage avant vérification — la vérité vient toujours de GET /documents/verify/{tokenId}.
export interface WalletQrPayload {
  app: "trustwedge-wallet";
  v: 1;
  tokenId: number;
  docType: DocType;
  docKey: string;
  ownerDid: string;
}

// ============================================================
// Divulgation sélective (wallet mobile — ShareScreen)
// ============================================================
// Un sous-ensemble choisi des attributs d'un document, signé par son propriétaire — distinct
// de WalletQrPayload (app: "trustwedge-wallet") par son propre marqueur `app`, pour que le
// scanner sache lequel des deux formats il a en face de lui.
export interface DisclosedField {
  key: string;
  label: string;
  value: string;
}

export interface SelectiveDisclosurePayload {
  app: "trustwedge-wallet-sd";
  v: 1;
  tokenId: number;
  owner: string;
  fields: DisclosedField[];
  timestamp: number; // epoch ms, au moment de la signature — la preuve expire 5 min après
  signature: string;
}

// Réponse de POST /documents/verify-shared
export interface SelectiveDisclosureVerifyResult {
  valid: boolean;
  doc_type: DocType;
  doc_key: string | null;
  owner_name: string | null;
  fields: DisclosedField[];
  verified_at: string;
}

// Document mis en cache localement dans le wallet (chiffré au repos, cf. storageService).
export interface CachedDocument {
  tokenId: number;
  docType: DocType;
  docKey: string;
  ownerDid: string;
  ownerAddress: string;
  issuerName: string | null;
  issuerAddress: string;
  ipfsCid: string;
  isActive: boolean;
  isTransferable: boolean;
  attributes: DocumentAttribute[];
  createdAt: string;
  cachedAt: string;
  hasLocalPdf: boolean;
}

// Identité du wallet stockée sur l'appareil (clé privée jamais incluse — cf. keyService).
export interface WalletIdentity {
  did: string;
  address: string;
  publicKey: string | null;
  fullName: string;
  email: string;
  role: UserRole;
  linkedAt: string;
  /** Rempli seulement à l'issue de KycVerificationScreen — null pour un compte importé
   * (linkExistingAccount) ou un DID créé mais pas encore passé par la vérification. */
  kycVerifiedAt?: string | null;
}

// ============================================================
// Vérification d'identité (KYC) — onboarding SSI (wallet uniquement, création d'un nouveau
// DID). Téléphone/email : vérification réelle (JWT à expiration côté backend), envoi mocké.
// OCR carte d'identité : réel (Tesseract). Reconnaissance faciale : mockée.
// ============================================================
export interface PhoneSendResult {
  token: string;
  /** Présent uniquement parce que l'envoi SMS est mocké — ne doit jamais exister en prod. */
  dev_code: string | null;
}

export interface VerificationResult {
  verified: boolean;
}

export interface EmailSendResult {
  token: string;
}

export interface IdCardFields {
  nom: string;
  prenom: string;
  date_naissance: string;
  num_cni: string;
  nationalite: string;
}

export interface FaceCompareResult {
  matched: boolean;
  similarity: number;
  mocked: boolean;
}

/** Dossier persisté à l'issue du parcours KYC mobile (cf. POST /verification/kyc/submit) —
 * contrairement aux étapes elles-mêmes (OTP/OCR/face-match), ce dossier est stocké pour être
 * revu par une banque ou un notaire depuis le web. */
export interface KycSubmitPayload {
  full_name: string;
  id_card_number?: string;
  id_card_data?: Record<string, string>;
  phone_verified: boolean;
  email_verified: boolean;
  face_match_passed: boolean;
}

export interface KycRecord {
  id: number;
  user_id: number;
  full_name: string;
  id_card_number: string | null;
  phone_verified: boolean;
  email_verified: boolean;
  face_match_passed: boolean;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewer_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

// ============================================================
// Partage de document par lien (wallet mobile — écran "Partages")
// ============================================================
export type ShareAccessLevel = "view" | "download";

// Réponse de POST /shares et GET /shares/mine
export interface DocumentShare {
  id: number;
  share_token: string;
  token_id: number;
  doc_type: DocType | null;
  doc_key: string | null;
  access_level: ShareAccessLevel;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

// Réponse publique de GET /shares/{share_token} — pas de champ sensible, lu par quiconque a le lien.
export interface ShareResolveResult {
  isValid: boolean;
  docType: DocType;
  docKey: string | null;
  owner_name: string | null;
  issuer_name: string | null;
  access_level: ShareAccessLevel;
  can_download: boolean;
}
