import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useWallet } from "@/context/WalletContext";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

/**
 * Pour quelqu'un qui n'a jamais eu de compte TrustWedge (typiquement : un acheteur qui veut
 * juste pouvoir vérifier des titres et recevoir le sien une fois la vente conclue, sans
 * qu'un admin n'ait dû le créer à l'avance). La paire de clés est générée sur l'appareil
 * (WalletContext.registerAccount → authService.registerNewAccount) et n'en sort jamais — seule
 * l'adresse publique part au serveur.
 */
export function RegisterScreen({}: Props) {
  const { registerAccount } = useWallet();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!fullName || !email || !password) {
      Alert.alert("Champs manquants", "Renseignez votre nom, votre email et un mot de passe.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Mot de passe trop court", "Choisissez au moins 6 caractères.");
      return;
    }
    setLoading(true);
    try {
      // Pas de navigation manuelle ici : registerAccount() fait passer WalletContext en
      // "needs_pin_setup" avec needsKyc=true, ce qui bascule automatiquement RootNavigator
      // sur KycVerificationScreen (cf. RootNavigator.tsx) — un navigation.replace() ici
      // viserait un navigateur en cours de démontage.
      await registerAccount(email.trim(), password, fullName.trim());
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ??
        error?.message ??
        "Inscription impossible. Cet email est peut-être déjà utilisé.";
      Alert.alert("Erreur d'inscription", detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Créer un nouveau DID</Text>
          <Text style={styles.subtitle}>
            Aucun compte Degya n'existe encore pour vous — c'est le cas par exemple d'un
            acheteur qui veut simplement pouvoir vérifier un titre et recevoir le sien plus
            tard. Votre clé est générée sur cet appareil et n'est jamais envoyée au serveur.
          </Text>

          <TextInput style={styles.input} placeholder="Nom complet" value={fullName} onChangeText={setFullName} />
          <TextInput
            style={styles.input}
            placeholder="email@exemple.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Mot de passe (6 caractères min.)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <PrimaryButton label="Créer mon DID" onPress={handleSubmit} loading={loading} />
        </ScrollView>
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
