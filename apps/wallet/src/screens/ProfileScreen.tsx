import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MainTabScreenProps } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/colors";
import { useWallet } from "@/context/WalletContext";

type Props = MainTabScreenProps<"Profile">;

export function ProfileScreen({}: Props) {
  const { identity, wipeWallet, lock } = useWallet();
  const [wiping, setWiping] = useState(false);

  function confirmWipe() {
    Alert.alert(
      "Déconnecter ce wallet",
      "Cela efface la clé privée, le PIN et toutes les attestations mises en cache sur cet appareil. Vos documents restent sur la blockchain et pourront être réimportés en vous reconnectant.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Déconnecter", style: "destructive", onPress: handleWipe },
      ]
    );
  }

  async function handleWipe() {
    setWiping(true);
    try {
      await wipeWallet();
    } finally {
      setWiping(false);
    }
  }

  const initials = identity?.fullName
    ? identity.fullName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
    : "?";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{identity?.fullName ?? "—"}</Text>
          <Text style={styles.email}>{identity?.email}</Text>
          {identity?.kycVerifiedAt && <Text style={styles.kycBadge}>✅ Identité vérifiée (KYC)</Text>}
        </View>

        {identity && (
          <View style={styles.card}>
            <Text style={styles.label}>Rôle</Text>
            <Text style={styles.value}>{identity.role}</Text>
            <Text style={[styles.label, styles.labelSpaced]}>Identifiant décentralisé (DID)</Text>
            <Text style={styles.did} numberOfLines={2}>{identity.did}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <PrimaryButton label="🔒 Verrouiller maintenant" onPress={lock} variant="secondary" />
          <PrimaryButton label="Déconnecter ce wallet" onPress={confirmWipe} loading={wiping} variant="danger" />
        </View>

        <Text style={styles.footnote}>Degya — vos documents, votre identité, votre contrôle.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: colors.textOnDark, fontSize: 26, fontWeight: "800" },
  name: { fontSize: 19, fontWeight: "800", color: colors.textPrimary },
  email: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  kycBadge: { fontSize: 12, color: colors.success, fontWeight: "700", marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  label: { fontSize: 12, color: colors.textSecondary, textTransform: "uppercase" },
  labelSpaced: { marginTop: 14 },
  value: { fontSize: 15, color: colors.textPrimary, fontWeight: "600", marginTop: 2 },
  did: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  actions: { gap: 10, marginTop: 24 },
  footnote: { textAlign: "center", color: colors.textSecondary, fontSize: 12, marginTop: 32 },
});
