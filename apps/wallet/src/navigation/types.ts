import type { CompositeScreenProps } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DocCategory, SelectiveDisclosureVerifyResult, VerifyResult } from "@trustwedge/shared";

export type AuthStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  Register: undefined;
  KycVerification: undefined;
  SetupPin: undefined;
};

export type LockStackParamList = {
  Lock: undefined;
};

// Onglets du bas ("Accueil" / "Wallet" / "Scanner" / "Partages" / "Profil", cf. maquettes
// DEGYA) — imbriqués dans MainStackParamList pour pouvoir pousser les écrans de détail
// (DocumentDetail, Verify, ...) par-dessus, hors de la barre d'onglets.
export type MainTabParamList = {
  Dashboard: undefined;
  // category/status absents = pas de filtre (toutes les attestations) — cf. clic sur une
  // catégorie ou une statistique depuis le tableau de bord (DashboardScreen).
  WalletList: { category?: DocCategory; status?: "verified" | "pending" } | undefined;
  Scan: undefined;
  Shares: undefined;
  Profile: undefined;
};

export type MainStackParamList = {
  MainTabs: undefined;
  DocumentDetail: { tokenId: number };
  DocumentHistory: { tokenId: number };
  ShareQR: { tokenId: number };
  Share: { tokenId: number };
  Verify: undefined;
  VerifyResult: { result: VerifyResult };
  VerifySelectiveResult: { result: SelectiveDisclosureVerifyResult };
};

/** Props d'un écran hébergé dans la barre d'onglets — donne accès à la fois à la navigation
 * entre onglets et à celle du stack parent (pour pousser DocumentDetail, Verify, ...). */
export type MainTabScreenProps<T extends keyof MainTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, T>,
  NativeStackScreenProps<MainStackParamList>
>;
