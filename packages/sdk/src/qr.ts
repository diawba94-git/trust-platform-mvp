import { WALLET_QR_APP_ID, WALLET_QR_VERSION } from "@trustwedge/shared";
import type { CachedDocument, WalletQrPayload } from "@trustwedge/shared";

/**
 * Encode/décode le payload du QR code de partage. Le QR ne fait volontairement foi de rien :
 * il ne contient que de quoi retrouver et pré-afficher le document (tokenId en premier lieu) —
 * la validation réelle repasse toujours par TrustWedgeApiClient.verifyDocument(tokenId), qui
 * relit l'état on-chain. Un QR falsifié ne peut donc jamais faire passer un document révoqué
 * ou inexistant pour valide.
 */
export function buildWalletQrPayload(doc: CachedDocument): WalletQrPayload {
  return {
    app: WALLET_QR_APP_ID,
    v: WALLET_QR_VERSION,
    tokenId: doc.tokenId,
    docType: doc.docType,
    docKey: doc.docKey,
    ownerDid: doc.ownerDid,
  };
}

export function encodeWalletQrPayload(doc: CachedDocument): string {
  return JSON.stringify(buildWalletQrPayload(doc));
}

export class InvalidQrPayloadError extends Error {}

/**
 * Ancien format du QR imprimé dans le certificat PDF de titre foncier (avant l'alignement du
 * générateur PDF sur ce module) : "TrustWedge|<DOC_TYPE>|<docKey>|token:<id>|cid:<cid>", du
 * texte brut plutôt que du JSON. Les documents déjà émis avant ce correctif portent encore ce
 * format — le décodeur doit continuer à les accepter. `ownerDid` n'est pas récupérable depuis
 * ce format, mais n'est de toute façon jamais utilisé pour la vérification réelle (tokenId
 * seul compte, cf. commentaire ci-dessus).
 */
function tryDecodeLegacyPdfQr(raw: string): WalletQrPayload | null {
  if (!raw.startsWith("TrustWedge|")) return null;
  const [, docType, docKey, tokenPart] = raw.split("|");
  const tokenMatch = tokenPart?.match(/^token:(\d+)$/);
  if (!tokenMatch) return null;
  return {
    app: WALLET_QR_APP_ID,
    v: WALLET_QR_VERSION,
    tokenId: Number(tokenMatch[1]),
    docType: docType ?? "LAND_TITLE",
    docKey: docKey ?? "",
    ownerDid: "",
  };
}

export function decodeWalletQrPayload(raw: string): WalletQrPayload {
  const legacy = tryDecodeLegacyPdfQr(raw);
  if (legacy) return legacy;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidQrPayloadError("QR code illisible : ce n'est pas une attestation TrustWedge.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as any).app !== WALLET_QR_APP_ID ||
    typeof (parsed as any).tokenId !== "number"
  ) {
    throw new InvalidQrPayloadError("QR code illisible : ce n'est pas une attestation TrustWedge.");
  }

  return parsed as WalletQrPayload;
}
