import React, { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WalletProvider, useWallet } from "@/context/WalletContext";
import { RootNavigator } from "@/navigation/RootNavigator";
import { requestNotificationPermission } from "@/services/notificationService";

function AppRoot() {
  const { status, lock } = useWallet();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Reverrouille automatiquement dès que l'app repasse en arrière-plan : la clé privée est
  // dans le Keychain (accès déjà protégé), mais le cache déchiffré en mémoire (documents,
  // identité) ne doit pas rester visible si le téléphone est repris par quelqu'un d'autre.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current === "active" && nextState.match(/inactive|background/)) {
        lock();
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [lock]);

  return (
    <>
      <StatusBar style="auto" />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <AppRoot />
      </WalletProvider>
    </SafeAreaProvider>
  );
}
