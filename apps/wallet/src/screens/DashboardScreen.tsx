import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { CachedDocument, DocCategory } from "@trustwedge/shared";
import { DOC_CATEGORY_LABELS, getDocTypeMeta } from "@trustwedge/shared";
import type { MainTabScreenProps } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/colors";
import { useWallet } from "@/context/WalletContext";
import { getLocalDocuments } from "@/services/documentService";

type Props = MainTabScreenProps<"Dashboard">;

const CATEGORY_ORDER: DocCategory[] = ["diplomas", "work", "real_estate", "administrative"];

// Icône par catégorie — cohérent avec les icônes par type de document (DOC_TYPE_META) sans
// dupliquer la couleur (une catégorie regroupe plusieurs types, donc plusieurs couleurs).
const CATEGORY_ICONS: Record<DocCategory, string> = {
  diplomas: "🎓",
  work: "💼",
  real_estate: "🏠",
  administrative: "🪪",
};

export function DashboardScreen({ navigation }: Props) {
  const { identity } = useWallet();
  const [documents, setDocuments] = useState<CachedDocument[]>([]);

  const load = useCallback(async () => {
    setDocuments(await getLocalDocuments());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const stats = useMemo(() => {
    const total = documents.length;
    // Simplification : le wallet ne modélise pas d'état "en attente" à proprement parler —
    // un document déjà reçu est soit actif (émis, non révoqué) soit révoqué. "Vérifiés" /
    // "En attente" reprend la terminologie des maquettes DEGYA en s'appuyant sur ce champ.
    const verified = documents.filter((d) => d.isActive).length;
    return { total, verified, pending: total - verified };
  }, [documents]);

  const categoryCounts = useMemo(() => {
    const counts: Record<DocCategory, number> = { diplomas: 0, work: 0, real_estate: 0, administrative: 0 };
    for (const doc of documents) {
      counts[getDocTypeMeta(doc.docType).category] += 1;
    }
    return counts;
  }, [documents]);

  const firstName = identity?.fullName?.split(" ")[0] ?? "";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Text style={styles.greeting}>Bonjour {firstName} 👋</Text>
          <Text style={styles.heroSubtitle}>Bienvenue dans votre wallet Degya.</Text>

          <Pressable
            style={({ pressed }) => [styles.statsCard, pressed && styles.statsCardPressed]}
            onPress={() => navigation.navigate("WalletList", {})}
          >
            <Text style={styles.statsBig}>{stats.total}</Text>
            <Text style={styles.statsLabel}>Documents · voir la liste ›</Text>
            <View style={styles.statsRow}>
              <Pressable onPress={() => navigation.navigate("WalletList", { status: "verified" })} hitSlop={6}>
                <Text style={styles.statsChip}>✓ {stats.verified} vérifiés</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate("WalletList", { status: "pending" })} hitSlop={6}>
                <Text style={styles.statsChip}>⏱ {stats.pending} en attente</Text>
              </Pressable>
            </View>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Catégories</Text>
            <Text style={styles.sectionLink} onPress={() => navigation.navigate("WalletList")}>
              Voir tout ›
            </Text>
          </View>
          <View style={styles.categoryGrid}>
            {CATEGORY_ORDER.map((category) => (
              <Pressable
                key={category}
                onPress={() => navigation.navigate("WalletList", { category })}
                style={({ pressed }) => [styles.categoryCard, pressed && styles.categoryCardPressed]}
              >
                <Text style={styles.categoryIcon}>{CATEGORY_ICONS[category]}</Text>
                <Text style={styles.categoryLabel}>{DOC_CATEGORY_LABELS[category]}</Text>
                <Text style={styles.categoryCount}>
                  {categoryCounts[category]} document{categoryCounts[category] > 1 ? "s" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <PrimaryButton label="🔍 Vérifier un document" onPress={() => navigation.navigate("Verify")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink },
  scroll: { paddingBottom: 40 },
  hero: { backgroundColor: colors.ink, padding: 24, paddingTop: 8 },
  greeting: { fontSize: 24, fontWeight: "800", color: colors.textOnDark },
  heroSubtitle: { fontSize: 14, color: colors.textOnDarkMuted, marginTop: 4 },
  statsCard: {
    backgroundColor: colors.inkSoft,
    borderRadius: 18,
    padding: 20,
    marginTop: 20,
  },
  statsCardPressed: { opacity: 0.85 },
  statsBig: { fontSize: 36, fontWeight: "800", color: colors.textOnDark },
  statsLabel: { fontSize: 14, color: colors.textOnDarkMuted, marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 16, marginTop: 14 },
  statsChip: { fontSize: 12, color: colors.textOnDark, opacity: 0.9 },
  section: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    marginTop: 12,
    minHeight: 320,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: colors.textPrimary },
  sectionLink: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  categoryCard: {
    width: "47%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryCardPressed: { opacity: 0.7 },
  categoryIcon: { fontSize: 24, marginBottom: 8 },
  categoryLabel: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  categoryCount: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
