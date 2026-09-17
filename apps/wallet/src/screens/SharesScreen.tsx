import React, { useCallback, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { DocumentShare } from "@trustwedge/shared";
import { getDocTypeMeta } from "@trustwedge/shared";
import type { MainTabScreenProps } from "@/navigation/types";
import { colors } from "@/theme/colors";
import { getMyShares, revokeShare } from "@/services/shareService";
import { connectionErrorMessage } from "@/utils/errorMessage";

type Props = MainTabScreenProps<"Shares">;
type StatusFilter = "all" | "active" | "inactive";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "active", label: "Actifs" },
  { key: "inactive", label: "Inactifs" },
];

function isExpired(share: DocumentShare): boolean {
  return !!share.expires_at && new Date(share.expires_at).getTime() < Date.now();
}

function statusLabel(share: DocumentShare): { text: string; style: "ok" | "pending" | "danger" } {
  if (share.revoked) return { text: "Révoqué", style: "danger" };
  if (isExpired(share)) return { text: "Expiré", style: "pending" };
  return { text: "✓ Actif", style: "ok" };
}

function formatExpiry(share: DocumentShare): string {
  if (!share.expires_at) return "Sans expiration";
  const formatted = new Date(share.expires_at).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return isExpired(share) ? `Expiré le ${formatted}` : `Expire le ${formatted}`;
}

export function SharesScreen({ navigation }: Props) {
  const [shares, setShares] = useState<DocumentShare[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setShares(await getMyShares());
      setError(null);
    } catch (err: any) {
      setError(connectionErrorMessage(err, "Impossible de charger vos partages — vérifiez votre connexion."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredShares = useMemo(() => {
    if (statusFilter === "active") return shares.filter((s) => !s.revoked && !isExpired(s));
    if (statusFilter === "inactive") return shares.filter((s) => s.revoked || isExpired(s));
    return shares;
  }, [shares, statusFilter]);

  function confirmRevoke(share: DocumentShare) {
    Alert.alert("Révoquer ce lien ?", "La personne qui le détient ne pourra plus l'ouvrir.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Révoquer",
        style: "destructive",
        onPress: async () => {
          try {
            await revokeShare(share.share_token);
            load();
          } catch {
            Alert.alert("Erreur", "Impossible de révoquer ce lien pour le moment.");
          }
        },
      },
    ]);
  }

  function handleCardMenu(share: DocumentShare) {
    const options: any[] = [];
    if (!share.revoked) {
      options.push({ text: "Révoquer", style: "destructive", onPress: () => confirmRevoke(share) });
    }
    options.push({ text: "Voir le document", onPress: () => navigation.navigate("DocumentDetail", { tokenId: share.token_id }) });
    options.push({ text: "Annuler", style: "cancel" });
    Alert.alert(share.doc_type ? getDocTypeMeta(share.doc_type).label : `Document #${share.token_id}`, share.doc_key ?? undefined, options);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Partages</Text>
        <Pressable style={styles.menuButton} onPress={() => navigation.navigate("Profile")}>
          <Text style={styles.menuButtonText}>☰</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          const count =
            tab.key === "all"
              ? shares.length
              : tab.key === "active"
              ? shares.filter((s) => !s.revoked && !isExpired(s)).length
              : shares.filter((s) => s.revoked || isExpired(s)).length;
          return (
            <Pressable
              key={tab.key}
              onPress={() => setStatusFilter(tab.key)}
              style={[styles.tabPill, active && styles.tabPillActive]}
            >
              <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
                {tab.label} · {count}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={filteredShares}
        keyExtractor={(item) => item.share_token}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              Aucun partage pour le moment. Ouvrez un document dans votre wallet puis "Partager
              par lien" pour en créer un.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const meta = item.doc_type ? getDocTypeMeta(item.doc_type) : null;
          const status = statusLabel(item);
          return (
            <Pressable
              onPress={() => navigation.navigate("DocumentDetail", { tokenId: item.token_id })}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            >
              <View style={[styles.accentBar, { backgroundColor: meta?.color ?? colors.textSecondary }]} />
              <View style={styles.body}>
                <View style={styles.topRow}>
                  <Text style={styles.docType} numberOfLines={1}>
                    {meta?.label ?? `Document #${item.token_id}`}
                  </Text>
                  <Pressable hitSlop={10} onPress={() => handleCardMenu(item)}>
                    <Text style={styles.menuDots}>⋯</Text>
                  </Pressable>
                </View>
                <View style={styles.bottomRow}>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    {item.access_level === "download" ? "Consultation + téléchargement" : "Consultation seule"} · {formatExpiry(item)}
                  </Text>
                  <Text
                    style={[
                      styles.status,
                      status.style === "ok" && styles.statusOk,
                      status.style === "pending" && styles.statusPending,
                      status.style === "danger" && styles.statusDanger,
                    ]}
                  >
                    {status.text}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
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
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardPressed: { opacity: 0.7 },
  accentBar: { width: 5 },
  body: { flex: 1, padding: 16, gap: 8 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  docType: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, flexShrink: 1 },
  menuDots: { fontSize: 18, color: colors.textSecondary, fontWeight: "700", paddingHorizontal: 4 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  subtitle: { fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  status: { fontSize: 12, fontWeight: "700" },
  statusOk: { color: colors.success },
  statusPending: { color: colors.warning },
  statusDanger: { color: colors.danger },
});
