import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useWallet } from "@/context/WalletContext";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export function LoginScreen({}: Props) {
  const { linkAccount } = useWallet();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert("Champs manquants", "Renseignez votre email et votre mot de passe Degya.");
      return;
    }
    setLoading(true);
    try {
      // Pas de navigation manuelle : linkAccount() fait passer WalletContext en
      // "needs_pin_setup", ce qui bascule automatiquement RootNavigator sur SetupPinScreen.
      await linkAccount(email.trim(), password);
    } catch (error: any) {
      // error?.response?.data?.detail : erreur renvoyée par l'API (identifiants invalides, etc).
      // error?.message : erreur JS locale (SecureStore, AsyncStorage, ...) — sans ce fallback,
      // ce genre d'échec s'affichait comme un message générique impossible à diagnostiquer.
      const detail =
        error?.response?.data?.detail ??
        error?.message ??
        "Connexion impossible. Vérifiez vos identifiants et le réseau.";
      Alert.alert("Erreur de connexion", detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Connexion</Text>
          <Text style={styles.subtitle}>
            Utilisez le compte Degya déjà créé pour vous (par un administrateur, une
            université, une entreprise, ...). Le wallet importe alors votre DID existant.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="email@trustwedge.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <PrimaryButton label="Se connecter" onPress={handleSubmit} loading={loading} />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
  },
});
