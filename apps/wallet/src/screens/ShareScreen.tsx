import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CachedDocument, SelectiveDisclosurePayload } from "@trustwedge/shared";
import { getDocTypeLabel } from "@trustwedge/shared";
import type { MainStackParamList } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/colors";
import { useWallet } from "@/context/WalletContext";
import { getLocalDocument } from "@/services/documentService";
import { buildSelectiveDisclosurePayload, getSelectableFields, type SelectableField } from "@/services/selectiveDisclosureService";

type Props = NativeStackScreenProps<MainStackParamList, "Share">;

const PROOF_TTL_SECONDS = 5 * 60;

/**
 * Divulgation sélective : l'utilisateur choisit un sous-ensemble des champs de son document
 * (ex: "Propriétaire", "Localisation", "Valeur" pour un titre foncier présenté à une banque,
 * sans exposer le reste). Les champs choisis sont signés avec la clé privée du wallet et
 * encodés dans un QR — la preuve expire 5 minutes après génération (cf.
 * routers/disclosure.py) pour qu'une capture d'écran ne reste pas indéfiniment valable.
 */
export function ShareScreen({ route }: Props) {
  const { tokenId } = route.params;
  const { identity } = useWallet();
  const [doc, setDoc] = useState<CachedDocument | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [payload, setPayload] = useState<SelectiveDisclosurePayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(PROOF_TTL_SECONDS);

  useEffect(() => {
    getLocalDocument(tokenId).then(setDoc);
  }, [tokenId]);

  const fields = useMemo<SelectableField[]>(
    () => (doc ? getSelectableFields(doc, identity?.fullName) : []),
    [doc, identity?.fullName]
  );

  function toggleField(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleGenerate() {
    if (!doc || selected.size === 0) return;
    setGenerating(true);
    try {
      const chosenFields = fields.filter((f) => selected.has(f.key)).map(({ key, label, value }) => ({ key, label, value }));
      const built = await buildSelectiveDisclosurePayload(doc.tokenId, chosenFields);
      setPayload(built);
      setSecondsLeft(PROOF_TTL_SECONDS);
    } catch (error: any) {
      Alert.alert("Génération impossible", error?.message ?? "Vérifiez votre connexion et réessayez.");
    } finally {
      setGenerating(false);
    }
  }

  // Décompte visuel de la fenêtre de validité (5 min) — au-delà, le backend refuse la preuve
  // (410 Gone) même si le QR reste affiché à l'écran.
  useEffect(() => {
    if (!payload) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [payload]);

  if (!doc) return null;

  if (payload) {
    const expired = secondsLeft <= 0;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Partage sélectif</Text>
          <Text style={styles.subtitle}>{getDocTypeLabel(doc.docType)} · {payload.fields.length} champ{payload.fields.length > 1 ? "s" : ""} partagé{payload.fields.length > 1 ? "s" : ""}</Text>

          <View style={styles.qrWrapper}>
            {expired ? (
              <Text style={styles.expiredText}>QR expiré</Text>
            ) : (
              <QRCode value={JSON.stringify(payload)} size={240} />
            )}
          </View>

          <Text style={[styles.timer, expired && styles.timerExpired]}>
            {expired ? "Ce QR n'est plus valide." : `Valide encore ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
          </Text>

          <View style={styles.fieldsPreview}>
            {payload.fields.map((f) => (
              <Text key={f.key} style={styles.fieldsPreviewRow}>• {f.label} : {f.value}</Text>
            ))}
          </View>

          <PrimaryButton
            label={expired ? "🔄 Régénérer le QR code" : "Choisir d'autres champs"}
            onPress={() => setPayload(null)}
            variant={expired ? "primary" : "secondary"}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Partage sélectif</Text>
        <Text style={styles.subtitle}>
          Choisissez uniquement les informations à montrer — le reste du document ne sera pas
          divulgué.
        </Text>

        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{selected.size} champ{selected.size > 1 ? "s" : ""} sélectionné{selected.size > 1 ? "s" : ""}</Text>
        </View>

        <View style={styles.fieldList}>
          {fields.map((field) => {
            const checked = selected.has(field.key);
            return (
              <View key={field.key} style={styles.fieldRow} onTouchEnd={() => toggleField(field.key)}>
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <View style={styles.fieldInfo}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldValue} numberOfLines={1}>{field.value}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <PrimaryButton
          label="🔒 Générer le QR code"
          onPress={handleGenerate}
          loading={generating}
          disabled={selected.size === 0}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { padding: 24, alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontWeight: "800", color: colors.textPrimary, alignSelf: "flex-start" },
  subtitle: { fontSize: 13, color: colors.textSecondary, alignSelf: "flex-start", marginBottom: 12, lineHeight: 19 },
  countBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  countBadgeText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  fieldList: { width: "100%", gap: 8, marginBottom: 20 },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxMark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  fieldInfo: { flex: 1 },
  fieldLabel: { fontSize: 14, fontWeight: "700", color: colors.textPrimary },
  fieldValue: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  qrWrapper: {
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
    minHeight: 280,
    minWidth: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  expiredText: { fontSize: 16, fontWeight: "700", color: colors.danger },
  timer: { marginTop: 12, fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  timerExpired: { color: colors.danger },
  fieldsPreview: { alignSelf: "stretch", marginTop: 16, marginBottom: 20, gap: 4 },
  fieldsPreviewRow: { fontSize: 13, color: colors.textSecondary },
});
