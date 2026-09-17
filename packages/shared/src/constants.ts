import type { DocumentAttribute } from "./types";

// Clés alignées sur les valeurs réelles de doc_type émises par le backend
// (services/backend/app/services/pdf_generator.py:DOC_TYPE_TITLES).
export type DocCategory = "diplomas" | "work" | "real_estate" | "administrative";

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  diplomas: "Diplômes",
  work: "Travail",
  real_estate: "Immobilier",
  administrative: "Administratif",
};

export interface DocTypeMeta {
  label: string;
  category: DocCategory;
  /** Couleur d'accent de la carte document (fond/bordure), cf. maquettes DEGYA. */
  color: string;
  icon: string;
}

export const DOC_TYPE_META: Record<string, DocTypeMeta> = {
  DIPLOMA: { label: "Diplôme", category: "diplomas", color: "#7C3AED", icon: "🎓" },
  EMPLOYMENT: { label: "Attestation d'emploi", category: "work", color: "#2563EB", icon: "💼" },
  LAND_TITLE: { label: "Titre foncier", category: "real_estate", color: "#059669", icon: "🏠" },
  ID_CARD: { label: "Carte d'identité", category: "administrative", color: "#EA580C", icon: "🪪" },
  BIRTH_CERTIFICATE: { label: "Acte de naissance", category: "administrative", color: "#DB2777", icon: "📜" },
  RESIDENCE_CERTIFICATE: { label: "Attestation de résidence", category: "administrative", color: "#0891B2", icon: "🏘️" },
};

const DEFAULT_DOC_TYPE_META: DocTypeMeta = {
  label: "",
  category: "administrative",
  color: "#6B7280",
  icon: "📄",
};

export function getDocTypeMeta(docType: string): DocTypeMeta {
  const meta = DOC_TYPE_META[docType];
  if (meta) return meta;
  return { ...DEFAULT_DOC_TYPE_META, label: docType };
}

export function getDocTypeLabel(docType: string): string {
  return getDocTypeMeta(docType).label;
}

export const WALLET_QR_APP_ID = "trustwedge-wallet" as const;
export const WALLET_QR_VERSION = 1 as const;

/** Raccourcit une adresse/DID pour l'affichage (ex: "0x1234...abcd"). */
export function shortenAddress(address: string, chars = 4): string {
  const prefix = address.startsWith("did:ethr:") ? "did:ethr:" : "";
  const raw = prefix ? address.slice(prefix.length) : address;
  if (raw.length <= chars * 2 + 2) return address;
  return `${prefix}${raw.slice(0, chars + 2)}...${raw.slice(-chars)}`;
}

/** Formate un timestamp Unix (secondes, tel que renvoyé par le contrat) en date lisible fr-FR. */
export function formatUnixTimestamp(timestampSeconds: number): string {
  return new Date(timestampSeconds * 1000).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formate un nombre avec des espaces comme séparateurs de milliers (convention française),
 * ex: "20000000" -> "20 000 000". Miroir de _format_thousands côté backend
 * (services/backend/app/services/pdf_generator.py) — garder les deux alignés.
 */
export function formatThousands(value: string | number): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString("fr-FR");
}

/** Formate la valeur d'un attribut de document pour l'affichage : ajoute les séparateurs de
 * milliers pour les montants/quantités (uint256 — superficie, salaire, valeur estimée, ...),
 * laisse les autres types (texte, date, adresse) inchangés. */
export function formatAttributeValue(attr: DocumentAttribute): string {
  if (attr.valueType === "uint256") return formatThousands(attr.value);
  return attr.value;
}

// Libellés lisibles pour les clés techniques d'attributs (cf. LAND_TITLE_FIELDS et
// équivalents dans services/frontend/src/pages/*) — utilisé par ShareScreen.tsx (wallet) pour
// présenter les champs divulgables, faute d'un libellé transporté par le contrat lui-même.
export const ATTRIBUTE_LABELS: Record<string, string> = {
  location: "Localisation",
  landArea: "Superficie",
  value: "Valeur estimée",
  salary: "Salaire mensuel",
  position: "Poste",
  startDate: "Date d'entrée",
  fieldOfStudy: "Filière",
  graduationDate: "Date de diplôme",
  grade: "Mention",
  nom: "Nom",
  prenom: "Prénom",
  date_naissance: "Date de naissance",
  num_cni: "Numéro CNI",
  nationalite: "Nationalité",
};

export function getAttributeLabel(key: string): string {
  return ATTRIBUTE_LABELS[key] ?? key;
}
