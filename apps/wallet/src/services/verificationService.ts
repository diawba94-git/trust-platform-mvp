import type { DocumentHistory, SelectiveDisclosurePayload, SelectiveDisclosureVerifyResult, VerifyResult, WalletQrPayload } from "@trustwedge/shared";
import { decodeWalletQrPayload } from "@trustwedge/sdk";
import { apiClient } from "./sdk";

export type ScanOutcome =
  | { kind: "standard"; qrPayload: WalletQrPayload; result: VerifyResult }
  | { kind: "selective"; result: SelectiveDisclosureVerifyResult };

/**
 * Point d'entrée unique du scan : distingue le QR de divulgation sélective (ShareScreen —
 * marqueur `app: "trustwedge-wallet-sd"`, un sous-ensemble de champs signé) du QR de partage
 * complet (ShareQRScreen / certificat PDF, cf. decodeWalletQrPayload). Dans les deux cas, le
 * contenu du QR ne fait jamais foi de rien à lui seul : la validité vient toujours de l'API
 * (verify-shared ou verify/{tokenId}), qui relit l'état réel on-chain.
 */
export async function verifyScannedQrCode(rawQrValue: string): Promise<ScanOutcome> {
  let parsed: any = null;
  try {
    parsed = JSON.parse(rawQrValue);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === "object" && parsed.app === "trustwedge-wallet-sd") {
    const result = await apiClient.verifySharedDocument(parsed as SelectiveDisclosurePayload);
    return { kind: "selective", result };
  }

  const qrPayload = decodeWalletQrPayload(rawQrValue);
  const result = await apiClient.verifyDocument(qrPayload.tokenId);
  return { kind: "standard", qrPayload, result };
}

export async function verifyByTokenId(tokenId: number): Promise<VerifyResult> {
  return apiClient.verifyDocument(tokenId);
}

/** Historique complet (versions + propriétaires successifs) d'un document, lu on-chain. */
export async function getDocumentHistory(tokenId: number): Promise<DocumentHistory> {
  return apiClient.getDocumentVersions(tokenId);
}
