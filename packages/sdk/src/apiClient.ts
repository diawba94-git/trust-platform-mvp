import axios, { AxiosInstance } from "axios";
import type {
  AuthUser,
  DocumentHistory,
  DocumentShare,
  DocumentSummary,
  EmailSendResult,
  FaceCompareResult,
  IdCardFields,
  KycRecord,
  KycSubmitPayload,
  MyCredentials,
  PhoneSendResult,
  SelectiveDisclosurePayload,
  SelectiveDisclosureVerifyResult,
  ShareAccessLevel,
  ShareResolveResult,
  TokenResponse,
  VerificationResult,
  VerifyResult,
} from "@trustwedge/shared";

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  /** Toujours "USER" côté wallet — les rôles institutionnels restent provisionnés par un admin. */
  role: "USER";
  /** Adresse déjà générée par l'appelant (cf. authService.registerNewAccount côté wallet) —
   * le backend ne génère pas de clé pour cette route, contrairement à la création d'acteur admin. */
  address: string;
}

export interface TrustWedgeApiClientOptions {
  /** Base URL de l'API, ex: http://192.168.1.20:8000/api (Kong strippe /api côté backend). */
  baseUrl: string;
  /** Fournit le JWT courant (ou null) à chaque requête — le wallet gère son propre stockage. */
  getToken?: () => Promise<string | null> | string | null;
  timeoutMs?: number;
}

export interface VerifyFileResult {
  match: boolean;
  computed_cid: string;
  onchain_cid: string;
}

/**
 * Client REST fin pour l'API TrustWedge existante. N'ajoute aucune logique métier :
 * un miroir typé des routes déjà exposées par services/backend/app (main.py + routers/*).
 */
export class TrustWedgeApiClient {
  private http: AxiosInstance;
  private getToken?: TrustWedgeApiClientOptions["getToken"];

  constructor(options: TrustWedgeApiClientOptions) {
    this.getToken = options.getToken;
    this.http = axios.create({
      baseURL: options.baseUrl,
      timeout: options.timeoutMs ?? 15000,
    });

    this.http.interceptors.request.use(async (config) => {
      const token = await this.getToken?.();
      if (token) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  setBaseUrl(baseUrl: string) {
    this.http.defaults.baseURL = baseUrl;
  }

  // ------------------------------------------------------------
  // Auth
  // ------------------------------------------------------------
  async login(email: string, password: string): Promise<TokenResponse> {
    const { data } = await this.http.post<TokenResponse>("/auth/login", { email, password });
    return data;
  }

  /**
   * Auto-inscription — utilisée quand l'utilisateur n'a pas de compte TrustWedge préexistant
   * (ex: un acheteur qui veut juste vérifier/recevoir un titre, jamais provisionné par un
   * admin). Public, sans authentification. Ne crée aucune clé côté serveur : `address` doit
   * déjà être celle d'une paire de clés générée localement (cf. authService.registerNewAccount).
   */
  async register(payload: RegisterPayload): Promise<AuthUser> {
    const { data } = await this.http.post<AuthUser>("/auth/register", payload);
    return data;
  }

  // ------------------------------------------------------------
  // DID — identité de l'utilisateur authentifié
  // ------------------------------------------------------------
  async getMyCredentials(): Promise<MyCredentials> {
    const { data } = await this.http.get<MyCredentials>("/did/my");
    return data;
  }

  // ------------------------------------------------------------
  // Documents
  // ------------------------------------------------------------
  async getMyDocuments(): Promise<DocumentSummary[]> {
    const { data } = await this.http.get<DocumentSummary[]>("/documents/my");
    return data;
  }

  /** Public, sans authentification — c'est la source de vérité pour la vérification. */
  async verifyDocument(tokenId: number): Promise<VerifyResult> {
    const { data } = await this.http.get<VerifyResult>(`/documents/verify/${tokenId}`);
    return data;
  }

  async getDocumentVersions(tokenId: number): Promise<DocumentHistory> {
    const { data } = await this.http.get<DocumentHistory>(`/documents/${tokenId}/versions`);
    return data;
  }

  async getOwnerAtTimestamp(tokenId: number, timestamp: number): Promise<{ owner: string }> {
    const { data } = await this.http.get(`/documents/${tokenId}/owner-at`, {
      params: { timestamp },
    });
    return data;
  }

  /** Télécharge le PDF (binaire) associé à un CID IPFS, en passant par le backend (auth requise). */
  async downloadDocumentPdf(cid: string): Promise<ArrayBuffer> {
    const { data } = await this.http.get<ArrayBuffer>(`/documents/download/${cid}`, {
      responseType: "arraybuffer",
    });
    return data;
  }

  /** Détecte une falsification en comparant le hash d'un fichier local au CID on-chain. */
  async verifyFile(tokenId: number, file: { uri: string; name: string; type: string }): Promise<VerifyFileResult> {
    const form = new FormData();
    // @ts-expect-error - RN's FormData accepts {uri,name,type} objects, unlike the DOM lib type.
    form.append("file", { uri: file.uri, name: file.name, type: file.type });
    const { data } = await this.http.post<VerifyFileResult>(
      `/documents/${tokenId}/verify-file`,
      form,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return data;
  }

  // ------------------------------------------------------------
  // Vérification d'identité (KYC) — onboarding SSI, cf. routers/verification.py
  // ------------------------------------------------------------
  async sendPhoneVerificationCode(phone: string): Promise<PhoneSendResult> {
    const { data } = await this.http.post<PhoneSendResult>("/verification/phone/send", { phone });
    return data;
  }

  async verifyPhoneCode(token: string, code: string): Promise<VerificationResult> {
    const { data } = await this.http.post<VerificationResult>("/verification/phone/verify", { token, code });
    return data;
  }

  async sendEmailVerification(email: string): Promise<EmailSendResult> {
    const { data } = await this.http.post<EmailSendResult>("/verification/email/send", { email });
    return data;
  }

  async verifyEmailToken(token: string): Promise<VerificationResult> {
    const { data } = await this.http.post<VerificationResult>("/verification/email/verify", { token });
    return data;
  }

  /** OCR réel (Tesseract côté backend) — `imageBase64` sans préfixe "data:...;base64,". */
  async extractIdCardFields(imageBase64: string): Promise<IdCardFields> {
    const { data } = await this.http.post<IdCardFields>("/verification/id-card/extract", {
      image_base64: imageBase64,
    });
    return data;
  }

  /** Mocké côté backend — voir services/face_match_service.py. */
  async compareFaces(cardImageBase64: string, selfieImageBase64: string): Promise<FaceCompareResult> {
    const { data } = await this.http.post<FaceCompareResult>("/verification/face/compare", {
      card_image_base64: cardImageBase64,
      selfie_image_base64: selfieImageBase64,
    });
    return data;
  }

  /** Authentifié — persiste le dossier KYC à l'issue du parcours mobile, pour revue par une
   * banque ou un notaire côté web (cf. routers/kyc.py). */
  async submitKyc(payload: KycSubmitPayload): Promise<KycRecord> {
    const { data } = await this.http.post<KycRecord>("/verification/kyc/submit", {
      full_name: payload.full_name,
      id_card_number: payload.id_card_number,
      id_card_data: payload.id_card_data ?? {},
      phone_verified: payload.phone_verified,
      email_verified: payload.email_verified,
      face_match_passed: payload.face_match_passed,
    });
    return data;
  }

  // ------------------------------------------------------------
  // Partage par lien (écran "Partages")
  // ------------------------------------------------------------
  async createShare(
    tokenId: number,
    accessLevel: ShareAccessLevel = "view",
    expiresInDays: number | null = 7
  ): Promise<DocumentShare> {
    const { data } = await this.http.post<DocumentShare>("/shares", {
      token_id: tokenId,
      access_level: accessLevel,
      expires_in_days: expiresInDays,
    });
    return data;
  }

  async getMyShares(): Promise<DocumentShare[]> {
    const { data } = await this.http.get<DocumentShare[]>("/shares/mine");
    return data;
  }

  async revokeShare(shareToken: string): Promise<void> {
    await this.http.delete(`/shares/${shareToken}`);
  }

  /** Public, sans authentification — c'est le but d'un lien de partage. */
  async resolveShare(shareToken: string): Promise<ShareResolveResult> {
    const { data } = await this.http.get<ShareResolveResult>(`/shares/${shareToken}`);
    return data;
  }

  // ------------------------------------------------------------
  // Divulgation sélective (ShareScreen — QR contenant un sous-ensemble de champs signé)
  // ------------------------------------------------------------
  /** Public, sans authentification — le vérificateur qui scanne n'a pas forcément de compte. */
  async verifySharedDocument(payload: SelectiveDisclosurePayload): Promise<SelectiveDisclosureVerifyResult> {
    const { data } = await this.http.post<SelectiveDisclosureVerifyResult>("/documents/verify-shared", {
      token_id: payload.tokenId,
      owner: payload.owner,
      fields: payload.fields,
      timestamp: payload.timestamp,
      signature: payload.signature,
    });
    return data;
  }
}
