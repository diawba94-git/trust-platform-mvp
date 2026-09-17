import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function StatusBadge({ isValid, isActive }: { isValid: boolean; isActive?: boolean }) {
  const ok = isValid && isActive !== false;
  return (
    <View style={[styles.badge, ok ? styles.ok : styles.ko]}>
      <Text style={styles.text}>{ok ? "✅ Authentique" : "❌ Invalide ou révoqué"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 },
  ok: { backgroundColor: "#e3f5e8" },
  ko: { backgroundColor: "#fbe4e2" },
  text: { fontWeight: "700", fontSize: 14, color: "#111827" },
});
