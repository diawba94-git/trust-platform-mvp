import { TrustWedgeApiClient } from "@trustwedge/sdk";
import { env } from "@/config/env";
import { getValidToken } from "./sessionService";

/** Instance unique du client API, partagée par tous les services du wallet. */
export const apiClient = new TrustWedgeApiClient({
  baseUrl: env.apiUrl,
  getToken: () => getValidToken(),
});
