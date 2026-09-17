import { Contract, JsonRpcProvider } from "ethers";
import DocumentRegistryAbi from "./abi/DocumentRegistry.abi.json";
import type { DocType, DocumentAttribute } from "@trustwedge/shared";

export interface ContractVerifyResult {
  isValid: boolean;
  issuerDid: string;
  issuerAddress: string;
  owner: string;
  docType: DocType;
  docKey: string;
  ipfsCid: string;
}

export interface ContractDocumentVersion {
  ipfsCid: string;
  owner: string;
  timestamp: number;
}

/**
 * Client de lecture directe sur le contrat DocumentRegistry (services/nodes/contrat/DocumentRegistry.sol),
 * via JSON-RPC (web3) — aucune écriture n'est exposée ici : le wallet ne signe jamais de
 * transaction, il ne fait que lire l'état on-chain en clair.
 *
 * ⚠️ Prérequis infra : dans docker-compose.yml, le RPC Besu (besu-node-4, port 8645) n'est
 * publié qu'en loopback (127.0.0.1) — volontairement, pour ne pas exposer le RPC au réseau.
 * Un téléphone sur le même LAN ne peut donc PAS l'atteindre tel quel. Deux options :
 *   1. (recommandé) Ne pas utiliser ce client depuis le wallet mobile — passer par
 *      TrustWedgeApiClient.verifyDocument(), qui appelle le backend via Kong (déjà exposé,
 *      déjà public pour cette route) et retourne les mêmes données.
 *   2. Exposer un endpoint RPC en lecture seule (nouvelle route Kong dédiée, sans les
 *      namespaces ADMIN/DEBUG/TXPOOL) si la vérification 100% "trustless" sans dépendance au
 *      backend est requise. Non fait par défaut : c'est un changement d'infra volontaire, pas
 *      une simple option du wallet.
 * Ce client reste utile pour un usage desktop/CI en développement (RPC loopback direct), ou
 * une fois qu'un tel endpoint RPC public existe.
 */
export class TrustWedgeContractClient {
  private contract: Contract;

  constructor(rpcUrl: string, contractAddress: string) {
    const provider = new JsonRpcProvider(rpcUrl);
    this.contract = new Contract(contractAddress, DocumentRegistryAbi as any, provider);
  }

  async verifyDocument(tokenId: number): Promise<ContractVerifyResult> {
    const result = await this.contract.verifyDocument(tokenId);
    return {
      isValid: result[0],
      issuerDid: result[1],
      issuerAddress: result[2],
      owner: result[3],
      docType: result[4],
      docKey: result[5],
      ipfsCid: result[6],
    };
  }

  async getDocumentVersions(tokenId: number): Promise<ContractDocumentVersion[]> {
    const result = await this.contract.getDocumentVersions(tokenId);
    return result.map((v: any) => ({
      ipfsCid: v[0],
      owner: v[1],
      timestamp: Number(v[2]),
    }));
  }

  async getOwnerAtTimestamp(tokenId: number, timestamp: number): Promise<string> {
    return this.contract.getOwnerAtTimestamp(tokenId, timestamp);
  }

  async getAttributes(tokenId: number): Promise<DocumentAttribute[]> {
    const result = await this.contract.getAttributes(tokenId);
    return result.map((a: any) => ({ key: a[0], value: a[1], valueType: a[2] }));
  }

  async existsByTypeAndKey(docType: string, docKey: string): Promise<boolean> {
    return this.contract.existsByTypeAndKey(docType, docKey);
  }
}
