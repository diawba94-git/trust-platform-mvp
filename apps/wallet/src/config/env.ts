import Constants from "expo-constants";

interface WalletEnv {
  apiUrl: string;
  besuRpcUrl: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const env: WalletEnv = {
  apiUrl: extra.trustwedgeApiUrl ?? "http://localhost:8000/api",
  besuRpcUrl: extra.trustwedgeBesuRpcUrl ?? "http://127.0.0.1:8645",
};
