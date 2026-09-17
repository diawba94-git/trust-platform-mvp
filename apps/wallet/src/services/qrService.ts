import type { CachedDocument } from "@trustwedge/shared";
import { encodeWalletQrPayload } from "@trustwedge/sdk";

/** Valeur à encoder dans <QRCode value={...} /> (react-native-qrcode-svg) pour partager une attestation. */
export function getShareableQrValue(doc: CachedDocument): string {
  return encodeWalletQrPayload(doc);
}
