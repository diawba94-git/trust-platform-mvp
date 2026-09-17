import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DocumentHistory, DocumentVersionEntry } from "@trustwedge/shared";
import { formatUnixTimestamp, shortenAddress } from "@trustwedge/shared";
import type { MainStackParamList } from "@/navigation/types";
import { getDocumentHistory } from "@/services/verificationService";
import { connectionErrorMessage } from "@/utils/errorMessage";

type Props = NativeStackScreenProps<MainStackParamList, "DocumentHistory">;

/**
 * Historique complet des versions/propriétaires successifs d'un document, lu on-chain via
 * GET /documents/{tokenId}/versions (déjà dans le SDK — apiClient.getDocumentVersions — mais
 * jusqu'ici pas exposé dans l'UI).
 */
export function DocumentHistoryScreen({ route }: Props) {
  const { tokenId } = route.params;
  const [history, setHistory] = useState<DocumentHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDocumentHistory(tokenId)
      .then(setHistory)
      .catch((err) => setError(connectionErrorMessage(err, "Historique indisponible — vérifiez votre connexion et réessayez.")))
      .finally(() => setLoading(false));
  }, [tokenId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (error || !history) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.error}>{error ?? "Historique introuvable."}</Text>
      </SafeAreaView>
    );
  }

  return <DocumentHistoryList history={history} />;
}

// L'API renvoie les versions dans l'ordre chronologique (la plus ancienne d'abord, cf.
// routers/documents.py) — on les inverse ici pour afficher le propriétaire actuel en premier.
function DocumentHistoryList({ history }: { history: DocumentHistory }) {
  const versions = useMemo(() => [...history.versions].reverse(), [history.versions]);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={versions}
        keyExtractor={(item) => String(item.version_index)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>#{history.token_id} · {history.doc_key}</Text>
            <Text style={styles.headerSubtitle}>
              {history.versions.length} version{history.versions.length > 1 ? "s" : ""} enregistrée{history.versions.length > 1 ? "s" : ""}
            </Text>
          </View>
        }
        renderItem={({ item }) => <HistoryRow entry={item} />}
      />
    </SafeAreaView>
  );
}

function HistoryRow({ entry }: { entry: DocumentVersionEntry }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, entry.is_current && styles.dotCurrent]} />
      <View style={styles.rowContent}>
        <View style={styles.rowTop}>
          <Text style={styles.owner}>{entry.owner_name ?? shortenAddress(entry.owner)}</Text>
          {entry.is_current && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Actuel</Text>
            </View>
          )}
        </View>
        <Text style={styles.date}>{formatUnixTimestamp(entry.timestamp)}</Text>
        <Text style={styles.cid} numberOfLines={1}>CID : {entry.cid}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  list: { padding: 20 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  headerSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  error: { padding: 24, textAlign: "center", color: "#6b7280" },
  row: { flexDirection: "row", marginBottom: 4 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#d1d5db",
    marginTop: 6,
    marginRight: 12,
  },
  dotCurrent: { backgroundColor: "#059669" },
  rowContent: { flex: 1, paddingBottom: 16, borderLeftWidth: 1, borderLeftColor: "#e5e7eb", paddingLeft: 12, marginLeft: -17 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  owner: { fontSize: 15, fontWeight: "700", color: "#111827" },
  badge: { backgroundColor: "#e3f5e8", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#059669" },
  date: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  cid: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
});
