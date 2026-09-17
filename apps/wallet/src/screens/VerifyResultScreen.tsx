import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getDocTypeLabel } from "@trustwedge/shared";
import type { MainStackParamList } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusBadge } from "@/components/StatusBadge";

type Props = NativeStackScreenProps<MainStackParamList, "VerifyResult">;

export function VerifyResultScreen({ route, navigation }: Props) {
  const { result } = route.params;
  const ownerLabel = result.owner_name ?? result.owner;
  const issuerLabel = result.issuer_name ?? result.issuer;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <StatusBadge isValid={result.isValid} />

        <Text style={styles.headline}>
          {result.isValid ? `Document authentique — Propriétaire : ${ownerLabel}` : "Ce document n'est pas valide"}
        </Text>

        <View style={styles.card}>
          <Row label="Type" value={getDocTypeLabel(result.docType)} />
          <Row label="Référence" value={result.docKey} />
          <Row label="Propriétaire" value={ownerLabel} />
          <Row label="Émetteur" value={issuerLabel} />
          <Row label="DID émetteur" value={result.issuerDid} />
          <Row label="CID IPFS" value={result.ipfsCid} />
        </View>

        <Text style={styles.footnote}>
          Résultat lu en direct sur la blockchain Degya (GET /documents/verify) — pas une
          donnée mise en cache.
        </Text>

        <PrimaryButton label="Terminé" onPress={() => navigation.popToTop()} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, gap: 16 },
  headline: { fontSize: 20, fontWeight: "800", color: "#111827", lineHeight: 27 },
  card: { backgroundColor: "#f9fafb", borderRadius: 14, padding: 16, gap: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: "#6b7280", fontSize: 13 },
  rowValue: { color: "#111827", fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  footnote: { fontSize: 12, color: "#9ca3af", textAlign: "center" },
});
