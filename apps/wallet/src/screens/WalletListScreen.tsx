import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { CachedDocument } from "@trustwedge/shared";
import { DOC_CATEGORY_LABELS, getDocTypeMeta } from "@trustwedge/shared";
import type { MainTabScreenProps } from "@/navigation/types";
import { DocumentCard } from "@/components/DocumentCard";
import { colors } from "@/theme/colors";
import { getLocalDocuments } from "@/services/documentService";
import { syncAndNotifyNewDocuments } from "@/services/notificationService";

type Props = MainTabScreenProps<"WalletList">;
type StatusFilter = "all" | "verified" | "pending";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "verified", label: "Vérifiés" },
  { key: "pending", label: "En attente" },
];

export function WalletListScreen({ navigation, route }: Props) {
  const category = route.params?.category;
  const [documents, setDocuments] = useState<CachedDocument[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(route.params?.status ?? "all");
  const [refreshing, setRefreshing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Le tableau de bord peut ouvrir cet écran avec un filtre de statut déjà choisi (ex: clic sur
  // "✓ N vérifiés") — l'écran restant monté d'un onglet à l'autre, une simple valeur initiale
  // de useState ne suffit pas pour les navigations suivantes.
  useEffect(() => {
    if (route.params?.status) {
      setStatusFilter(route.params.status);
    }
  }, [route.params?.status]);

  const loadLocal = useCallback(async () => {
    setDocuments(await getLocalDocuments());
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setSyncError(null);
    try {
      await syncAndNotifyNewDocuments();
    } catch {
      // Le token peut avoir expiré (pas de refresh token côté backend) — les données locales
      // restent affichables, on informe juste que la synchro a échoué.
      setSyncError("Synchronisation impossible — reconnectez-vous depuis Profil si besoin.");
    } finally {
      await loadLocal();
      setRefreshing(false);
    }
  }, [loadLocal]);

  useEffect(() => {
    loadLocal().then(() => refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtre catégorie : appliqué en cliquant une catégorie depuis le tableau de bord (ex:
  // "Immobilier" → uniquement les titres fonciers) — cf. DashboardScreen.tsx.
  const byCategory = useMemo(() => {
    if (!category) return documents;
    return documents.filter((doc) => getDocTypeMeta(doc.docType).category === category);
  }, [documents, category]);

  // Filtre statut (onglets Tous/Vérifiés/En attente) : simplification — le wallet ne modélise
  // pas d'état "en attente" à proprement parler, un document reçu est actif ou révoqué.
  const filteredDocuments = useMemo(() => {
    if (statusFilter === "verified") return byCategory.filter((d) => d.isActive);
    if (statusFilter === "pending") return byCategory.filter((d) => !d.isActive);
    return byCategory;
  }, [byCategory, statusFilter]);

  function handleCardMenu(doc: CachedDocument) {
    Alert.alert(getDocTypeMeta(doc.docType).label, doc.docKey, [
      { text: "Voir le détail", onPress: () => navigation.navigate("DocumentDetail", { tokenId: doc.tokenId }) },
      { text: "Partager par QR code", onPress: () => navigation.navigate("ShareQR", { tokenId: doc.tokenId }) },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mon Wallet</Text>
        <Pressable style={styles.menuButton} onPress={() => navigation.navigate("Profile")}>
          <Text style={styles.menuButtonText}>☰</Text>
        </Pressable>
      </View>

      {category && (
        <View style={styles.categoryChipRow}>
          <Pressable style={styles.filterChip} onPress={() => navigation.setParams({ category: undefined })}>
            <Text style={styles.filterChipText}>{DOC_CATEGORY_LABELS[category]} ✕</Text>
          </Pressable>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          const count = tab.key === "all" ? byCategory.length : undefined;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setStatusFilter(tab.key)}
              style={[styles.tabPill, active && styles.tabPillActive]}
            >
              <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
                {tab.label}{count !== undefined ? ` · ${count}` : ""}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {syncError && <Text style={styles.error}>{syncError}</Text>}

      <FlatList
        data={filteredDocuments}
        keyExtractor={(item) => String(item.tokenId)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        renderItem={({ item }) => (
          <DocumentCard
            doc={item}
            onPress={() => navigation.navigate("DocumentDetail", { tokenId: item.tokenId })}
            onMenuPress={() => handleCardMenu(item)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {category
              ? `Aucune attestation dans "${DOC_CATEGORY_LABELS[category]}" pour le moment.`
              : "Aucune attestation pour le moment. Elle apparaîtra ici dès qu'un émetteur vous en délivrera une."}
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.textPrimary },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  menuButtonText: { fontSize: 18, color: colors.textPrimary },
  categoryChipRow: { paddingHorizontal: 20, paddingTop: 8 },
  filterChip: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  filterChipText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  tabsScroll: { flexGrow: 0, marginTop: 12 },
  tabsRow: { paddingHorizontal: 20, gap: 8 },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabPillText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  tabPillTextActive: { color: "#fff" },
  error: { color: colors.danger, paddingHorizontal: 20, marginTop: 8, fontSize: 12 },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  empty: { textAlign: "center", color: colors.textSecondary, marginTop: 40, paddingHorizontal: 24, lineHeight: 20 },
});
