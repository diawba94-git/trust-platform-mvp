import type { ShareAccessLevel } from "@trustwedge/shared";
import { apiClient } from "./sdk";

export const getMyShares = () => apiClient.getMyShares();
export const createShare = (tokenId: number, accessLevel: ShareAccessLevel, expiresInDays: number | null) =>
  apiClient.createShare(tokenId, accessLevel, expiresInDays);
export const revokeShare = (shareToken: string) => apiClient.revokeShare(shareToken);
