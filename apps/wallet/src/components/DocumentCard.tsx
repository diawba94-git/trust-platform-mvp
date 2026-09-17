import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CachedDocument } from "@trustwedge/shared";
import { getDocTypeMeta } from "@trustwedge/shared";
import { colors } from "@/theme/colors";

function issuedYear(doc: CachedDocument): string | null {
  const year = new Date(doc.createdAt).getFullYear();
  return Number.isNaN(year) ? null : String(year);
}

export function DocumentCard({
  doc,
  onPress,
  onMenuPress,
}: {
  doc: CachedDocument;
  onPress: () => void;
  onMenuPress?: () => void;
}) {
  const meta = getDocTypeMeta(doc.docType);
  const year = issuedYear(doc);
  const issuer = doc.issuerName ?? doc.issuerAddress;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.accentBar, { backgroundColor: meta.color }]} />
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.title} numberOfLines={1}>{meta.label}</Text>
          {onMenuPress && (
            <Pressable hitSlop={10} onPress={onMenuPress}>
              <Text style={styles.menuDots}>⋯</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.bottomRow}>
          <Text style={styles.subtitle} numberOfLines={1}>
            {issuer}{year ? ` · ${year}` : ""}
          </Text>
          <Text style={[styles.status, doc.isActive ? styles.statusOk : styles.statusPending]}>
            {doc.isActive ? "✓ Vérifié" : "En attente"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pressed: { opacity: 0.7 },
  accentBar: { width: 5 },
  body: { flex: 1, padding: 16, gap: 8 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "700", color: colors.textPrimary, flexShrink: 1 },
  menuDots: { fontSize: 18, color: colors.textSecondary, fontWeight: "700", paddingHorizontal: 4 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  subtitle: { fontSize: 13, color: colors.textSecondary, flexShrink: 1 },
  status: { fontSize: 12, fontWeight: "700" },
  statusOk: { color: colors.success },
  statusPending: { color: colors.warning },
});
