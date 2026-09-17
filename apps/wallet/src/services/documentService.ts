import type { CachedDocument, DocumentSummary } from "@trustwedge/shared";
import { apiClient } from "./sdk";
import {
  getDocumentsIndex,
  saveDocumentsIndex,
  savePdfForDocument,
  hasPdfForDocument,
  getDecryptedPdfUri,
} from "./storageService";

function toCachedDocument(summary: DocumentSummary, previouslyCached?: CachedDocument): CachedDocument {
  return {
    tokenId: summary.token_id,
    docType: summary.doc_type,
    docKey: summary.doc_key,
    ownerDid: `did:ethr:${summary.owner}`,
    ownerAddress: summary.owner,
    issuerName: summary.issuer,
    issuerAddress: summary.issuer_address,
    ipfsCid: summary.ipfs_cid,
    isActive: summary.is_active,
    isTransferable: summary.is_transferable,
    attributes: summary.attributes,
    createdAt: summary.created_at,
    cachedAt: new Date().toISOString(),
    hasLocalPdf: previouslyCached?.hasLocalPdf ?? false,
  };
}

/** Liste locale, à afficher immédiatement (fonctionne hors-ligne). */
export async function getLocalDocuments(): Promise<CachedDocument[]> {
  const docs = await getDocumentsIndex();
  return docs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getLocalDocument(tokenId: number): Promise<CachedDocument | null> {
  const docs = await getDocumentsIndex();
  return docs.find((d) => d.tokenId === tokenId) ?? null;
}

/**
 * Resynchronise depuis GET /documents/my (nécessite un token valide, donc une connexion
 * récente — cf. sessionService). Retourne les tokenId nouvellement vus, pour les notifications.
 */
export async function syncDocuments(): Promise<{ documents: CachedDocument[]; newTokenIds: number[] }> {
  const remote = await apiClient.getMyDocuments();
  const existing = await getDocumentsIndex();
  const existingIds = new Set(existing.map((d) => d.tokenId));

  const merged = remote.map((summary) =>
    toCachedDocument(
      summary,
      existing.find((d) => d.tokenId === summary.token_id)
    )
  );
  await saveDocumentsIndex(merged);

  const newTokenIds = remote.map((d) => d.token_id).filter((id) => !existingIds.has(id));
  return { documents: merged, newTokenIds };
}

export async function isPdfCached(tokenId: number): Promise<boolean> {
  return hasPdfForDocument(tokenId);
}

/** Télécharge le PDF depuis IPFS (via le backend, authentifié) et le met en cache chiffré. */
export async function downloadAndCachePdf(tokenId: number, ipfsCid: string): Promise<void> {
  const bytes = await apiClient.downloadDocumentPdf(ipfsCid);
  await savePdfForDocument(tokenId, bytes);

  const docs = await getDocumentsIndex();
  const next = docs.map((d) => (d.tokenId === tokenId ? { ...d, hasLocalPdf: true } : d));
  await saveDocumentsIndex(next);
}

/** Renvoie l'URI d'un fichier temporaire en clair, prêt à être ouvert/partagé. */
export async function getDocumentPdfUri(tokenId: number): Promise<string | null> {
  return getDecryptedPdfUri(tokenId);
}
