import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getDocTypeLabel } from "@trustwedge/shared";
import type { MainStackParamList } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusBadge } from "@/components/StatusBadge";
import { colors } from "@/theme/colors";

type Props = NativeStackScreenProps<MainStackParamList, "VerifySelectiveResult">;

/**
 * Résultat d'un QR de divulgation sélective scanné (cf. ScanScreen.tsx) — n'affiche que les
 * champs que le propriétaire a choisi de montrer, jamais le document complet. La validité
 * vient de POST /documents/verify-shared (signature + fraîcheur + non-falsification), pas des
 * données brutes du QR.
 */
export function VerifySelectiveResultScreen({ route, navigation }: Props) {
  const { result } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <StatusBadge isValid={result.valid} />

        <Text style={styles.headline}>
          {result.valid ? `${getDocTypeLabel(result.doc_type)} authentifié(e)` : "Preuve invalide"}
        </Text>
        {result.owner_name && <Text style={styles.owner}>Propriétaire vérifié : {result.owner_name}</Text>}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informations divulguées</Text>
          {result.fields.map((f) => (
            <View key={f.key} style={styles.row}>
              <Text style={styles.rowLabel}>{f.label}</Text>
              <Text style={styles.rowValue} numberOfLines={2}>{f.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.footnote}>
          Seuls ces champs ont été partagés par le propriétaire — le reste du document reste
          privé. Signature et fraîcheur (validité 5 min) vérifiées côté serveur, pas de confiance
          aveugle dans le contenu du QR.
        </Text>

        <PrimaryButton label="Terminé" onPress={() => navigation.popToTop()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 24, gap: 16 },
  headline: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, lineHeight: 27 },
  owner: { fontSize: 14, color: colors.textSecondary, marginTop: -8 },
  card: { backgroundColor: colors.background, borderRadius: 14, padding: 16, gap: 10 },
  cardTitle: { fontSize: 12, fontWeight: "700", color: colors.textSecondary, textTransform: "uppercase", marginBottom: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: colors.textSecondary, fontSize: 13 },
  rowValue: { color: colors.textPrimary, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  footnote: { fontSize: 12, color: colors.textSecondary, textAlign: "center", lineHeight: 17 },
});
