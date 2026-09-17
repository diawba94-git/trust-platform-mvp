import React from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AuthStackParamList, MainStackParamList, MainTabParamList } from "./types";
import { colors } from "@/theme/colors";
import { useWallet } from "@/context/WalletContext";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { LoginScreen } from "@/screens/LoginScreen";
import { RegisterScreen } from "@/screens/RegisterScreen";
import { KycVerificationScreen } from "@/screens/KycVerificationScreen";
import { SetupPinScreen } from "@/screens/SetupPinScreen";
import { LockScreen } from "@/screens/LockScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { WalletListScreen } from "@/screens/WalletListScreen";
import { ScanScreen } from "@/screens/ScanScreen";
import { SharesScreen } from "@/screens/SharesScreen";
import { ProfileScreen } from "@/screens/ProfileScreen";
import { DocumentDetailScreen } from "@/screens/DocumentDetailScreen";
import { DocumentHistoryScreen } from "@/screens/DocumentHistoryScreen";
import { ShareQRScreen } from "@/screens/ShareQRScreen";
import { ShareScreen } from "@/screens/ShareScreen";
import { VerifyScreen } from "@/screens/VerifyScreen";
import { VerifyResultScreen } from "@/screens/VerifyResultScreen";
import { VerifySelectiveResultScreen } from "@/screens/VerifySelectiveResultScreen";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainStack = createNativeStackNavigator<MainStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, color, size }: { label: string; color: string; size: number }) {
  return <Text style={{ fontSize: size, color }}>{label}</Text>;
}

// Wallet / Scanner : icônes vectorielles (@expo/vector-icons, fournies avec Expo) plutôt
// qu'emoji — plus proches des maquettes DEGYA. "scan" seul (Ionicons) n'est qu'un cadre sans
// motif QR à l'intérieur ; "qrcode-scan" (MaterialCommunityIcons) combine cadre + motif QR,
// comme sur la maquette.
function WalletTabIcon({ color, size }: { color: string; size: number }) {
  return <Ionicons name="wallet" color={color} size={size} />;
}

function ScanTabIcon({ color, size }: { color: string; size: number }) {
  return <MaterialCommunityIcons name="qrcode-scan" color={color} size={size} />;
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: true, title: "" }} />
      <AuthStack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: "" }} />
      <AuthStack.Screen name="SetupPin" component={SetupPinScreen} />
    </AuthStack.Navigator>
  );
}

// Barre d'onglets DEGYA (Accueil / Wallet / Scanner / Partages / Profil, cf. maquettes) —
// hébergée comme premier écran de MainStack pour pouvoir pousser les écrans de détail
// (DocumentDetail, Verify, ...) par-dessus, hors de la barre.
function MainTabs() {
  // Une hauteur fixe sur tabBarStyle désactive le calcul automatique de la marge de sécurité
  // basse par React Navigation — sur Android en navigation par gestes, les icônes se
  // retrouvaient sous la zone système (difficiles, voire impossibles, à toucher). On l'ajoute
  // explicitement via les vrais insets de l'appareil.
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { height: 56 + insets.bottom, paddingBottom: 8 + insets.bottom, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Accueil", tabBarIcon: (p) => <TabIcon label="🏠" {...p} /> }}
      />
      <Tab.Screen
        name="WalletList"
        component={WalletListScreen}
        options={{ title: "Wallet", tabBarIcon: WalletTabIcon }}
      />
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{ title: "Scanner", tabBarIcon: ScanTabIcon }}
      />
      <Tab.Screen
        name="Shares"
        component={SharesScreen}
        options={{ title: "Partages", tabBarIcon: (p) => <TabIcon label="🔗" {...p} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profil", tabBarIcon: (p) => <TabIcon label="👤" {...p} /> }}
      />
    </Tab.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainStack.Navigator>
      <MainStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <MainStack.Screen name="DocumentDetail" component={DocumentDetailScreen} options={{ title: "Attestation" }} />
      <MainStack.Screen name="DocumentHistory" component={DocumentHistoryScreen} options={{ title: "Historique" }} />
      <MainStack.Screen name="ShareQR" component={ShareQRScreen} options={{ title: "Partager" }} />
      <MainStack.Screen name="Share" component={ShareScreen} options={{ title: "Partage sélectif" }} />
      <MainStack.Screen name="Verify" component={VerifyScreen} options={{ title: "Vérifier" }} />
      <MainStack.Screen name="VerifyResult" component={VerifyResultScreen} options={{ title: "Résultat" }} />
      <MainStack.Screen
        name="VerifySelectiveResult"
        component={VerifySelectiveResultScreen}
        options={{ title: "Résultat" }}
      />
    </MainStack.Navigator>
  );
}

export function RootNavigator() {
  const { status, needsKyc } = useWallet();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.ink }}>
        <ActivityIndicator color={colors.textOnDark} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {status === "not_linked" && <AuthNavigator />}
      {status === "needs_pin_setup" && (
        <AuthStack.Navigator
          screenOptions={{ headerShown: false }}
          initialRouteName={needsKyc ? "KycVerification" : "SetupPin"}
        >
          <AuthStack.Screen name="KycVerification" component={KycVerificationScreen} />
          <AuthStack.Screen name="SetupPin" component={SetupPinScreen} />
        </AuthStack.Navigator>
      )}
      {status === "locked" && <LockScreen />}
      {status === "unlocked" && <MainNavigator />}
    </NavigationContainer>
  );
}
