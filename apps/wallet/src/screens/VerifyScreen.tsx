import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { MainStackParamList } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/colors";
import { verifyByTokenId } from "@/services/verificationService";

type Props = NativeStackScreenProps<MainStackParamList, "Verify">;

/**
 * Vérification d'un document tiers par Token ID saisi à la main — le scan de QR code se fait
 * désormais depuis l'onglet dédié "Scanner" (cf. ScanScreen.tsx), pour éviter deux points
 * d'entrée caméra différents dans l'app. GET /documents/verify/{tokenId} fait toujours foi,
 * jamais les données d'un QR.
 */
export function VerifyScreen({ navigation }: Props) {
  const [tokenIdInput, setTokenIdInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerifyManual() {
    const tokenId = Number(tokenIdInput);
    if (!tokenIdInput || Number.isNaN(tokenId)) {
      Alert.alert("Token ID invalide", "Entrez un identifiant numérique (ex: 3).");
      return;
    }
    setLoading(true);
    try {
      const result = await verifyByTokenId(tokenId);
      navigation.navigate("VerifyResult", { result });
    } catch (error: any) {
      Alert.alert(
        "Vérification impossible",
        error?.response?.status === 404
          ? "Aucun document ne correspond à ce Token ID."
          : "Vérifiez votre connexion et réessayez."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>🔍 Vérifier un document</Text>
          <Text style={styles.subtitle}>
            Entrez le Token ID communiqué par le propriétaire. Pour scanner son QR code de
            partage, utilisez l'onglet "Scanner".
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Token ID (ex: 3)"
            keyboardType="number-pad"
            value={tokenIdInput}
            onChangeText={setTokenIdInput}
            onSubmitEditing={handleVerifyManual}
          />

          <PrimaryButton label="🔍 Vérifier" onPress={handleVerifyManual} loading={loading} />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 24, gap: 12, marginTop: 16 },
  title: { fontSize: 22, fontWeight: "800", color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
  },
});
