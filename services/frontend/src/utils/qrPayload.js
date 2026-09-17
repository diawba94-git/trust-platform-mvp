// Décodage du QR code de partage TrustWedge — même format que le wallet mobile
// (packages/sdk/src/qr.ts, decodeWalletQrPayload) : JSON {app, v, tokenId, docType, docKey,
// ownerDid}, avec repli sur l'ancien format texte imprimé sur les certificats PDF de titre
// foncier ("TrustWedge|<DOC_TYPE>|<docKey>|token:<id>|cid:<cid>"). Le QR ne fait jamais foi :
// il sert seulement à retrouver le tokenId, la vérification réelle relit toujours l'état
// on-chain via GET /documents/verify/{tokenId}.
const WALLET_QR_APP_ID = 'trustwedge-wallet';

export class InvalidQrPayloadError extends Error {}

function tryDecodeLegacyPdfQr(raw) {
  if (!raw.startsWith('TrustWedge|')) return null;
  const [, docType, docKey, tokenPart] = raw.split('|');
  const tokenMatch = tokenPart?.match(/^token:(\d+)$/);
  if (!tokenMatch) return null;
  return { tokenId: Number(tokenMatch[1]), docType: docType || 'LAND_TITLE', docKey: docKey || '' };
}

export function decodeWalletQrPayload(raw) {
  const legacy = tryDecodeLegacyPdfQr(raw);
  if (legacy) return legacy;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidQrPayloadError("QR code illisible : ce n'est pas une attestation TrustWedge.");
  }

  if (!parsed || typeof parsed !== 'object' || parsed.app !== WALLET_QR_APP_ID || typeof parsed.tokenId !== 'number') {
    throw new InvalidQrPayloadError("QR code illisible : ce n'est pas une attestation TrustWedge.");
  }
  return parsed;
}
