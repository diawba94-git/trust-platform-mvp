import { Wallet } from "ethers";
import type { CachedDocument, DisclosedField, SelectiveDisclosurePayload } from "@trustwedge/shared";
import { formatAttributeValue, getAttributeLabel } from "@trustwedge/shared";
import { getPrivateKey } from "./keyService";
import { apiClient } from "./sdk";

/** Un champ divulgable proposé à l'utilisateur dans ShareScreen — soit un attribut réel du
 * document (location, valeur, salaire, ...), soit un champ "synthétique" dérivé (propriétaire,
 * référence, émetteur) qui n'est pas dans `attributes` mais que le backend sait tout autant
 * vérifier (cf. routers/disclosure.py:synthetic_fields). */
export interface SelectableField {
  key: string;
  label: string;
  value: string;
}

/** Liste des champs qu'on peut choisir de divulguer pour un document donné. Les champs
 * synthétiques sans valeur connue localement (ex: pas d'identité chargée) sont omis plutôt que
 * proposés vides. */
export function getSelectableFields(
  doc: CachedDocument,
  ownerFullName?: string | null
): SelectableField[] {
  const fields: SelectableField[] = [];
  if (ownerFullName) fields.push({ key: "owner_name", label: "Propriétaire", value: ownerFullName });
  if (doc.docKey) fields.push({ key: "doc_key", label: "Référence", value: doc.docKey });
  if (doc.issuerName) fields.push({ key: "issuer_name", label: "Émetteur", value: doc.issuerName });
  for (const attr of doc.attributes) {
    fields.push({ key: attr.key, label: getAttributeLabel(attr.key), value: formatAttributeValue(attr) });
  }
  return fields;
}

/**
 * Doit produire EXACTEMENT la même chaîne que build_canonical_message côté backend
 * (routers/disclosure.py) — une sérialisation JSON générique (JSON.stringify) ne garantirait
 * pas un ordre/espacement identique à json.dumps côté Python, d'où cette construction
 * manuelle explicite, chaîne pour chaîne.
 */
function buildCanonicalMessage(tokenId: number, owner: string, fields: DisclosedField[], timestamp: number): string {
  const fieldsPart = fields.map((f) => `${f.key}=${f.value}`).join(",");
  return `${tokenId}|${owner.toLowerCase()}|${timestamp}|${fieldsPart}`;
}

export class NoPrivateKeyError extends Error {}

/**
 * Signe les champs sélectionnés avec la clé privée du wallet (protégée par le Keychain —
 * `getPrivateKey()` déclenche l'authentification biométrique/PIN de l'appareil, cf.
 * keyService.ts) et construit le payload complet à encoder dans le QR code. La signature
 * EIP-191 (`signMessage`, "personal_sign") est vérifiable côté backend via
 * eth_account.Account.recover_message + encode_defunct — format standard, interopérable
 * sans dépendre d'un provider blockchain (signature hors-ligne, pas de transaction).
 */
export async function buildSelectiveDisclosurePayload(
  tokenId: number,
  fields: DisclosedField[]
): Promise<SelectiveDisclosurePayload> {
  const stored = await getPrivateKey();
  if (!stored) {
    throw new NoPrivateKeyError("Clé privée introuvable — reconnectez-vous depuis Profil.");
  }

  const wallet = new Wallet(stored.privateKey);
  const owner = wallet.address;
  const timestamp = Date.now();
  const canonical = buildCanonicalMessage(tokenId, owner, fields, timestamp);
  const signature = await wallet.signMessage(canonical);

  return {
    app: "trustwedge-wallet-sd",
    v: 1,
    tokenId,
    owner,
    fields,
    timestamp,
    signature,
  };
}

export const verifySharedDocument = (payload: SelectiveDisclosurePayload) => apiClient.verifySharedDocument(payload);
