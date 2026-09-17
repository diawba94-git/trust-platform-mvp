import React, { useCallback, useEffect, useState } from "react";
import { Alert, Share, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Sharing from "expo-sharing";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CachedDocument, ShareAccessLevel, VerifyResult } from "@trustwedge/shared";
import { formatAttributeValue, getDocTypeLabel } from "@trustwedge/shared";
import type { MainStackParamList } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { StatusBadge } from "@/components/StatusBadge";
import {
  downloadAndCachePdf,
  getDocumentPdfUri,
  getLocalDocument,
  isPdfCached,
} from "@/services/documentService";
import { verifyByTokenId } from "@/services/verificationService";
import { createShare } from "@/services/shareService";
import { env } from "@/config/env";
import { connectionErrorMessage } from "@/utils/errorMessage";

type Props = NativeStackScreenProps<MainStackParamList, "DocumentDetail">;

export function DocumentDetailScreen({ route, navigation }: Props) {
  const { tokenId } = route.params;
  const [doc, setDoc] = useState<CachedDocument | null>(null);
  const [pdfCached, setPdfCached] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    const local = await getLocalDocument(tokenId);
    setDoc(local);
    setPdfCached(await isPdfCached(tokenId));
  }, [tokenId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDownloadPdf() {
    if (!doc) return;
    setDownloading(true);
    try {
      await downloadAndCachePdf(doc.tokenId, doc.ipfsCid);
      setPdfCached(true);
    } catch (err: any) {
      Alert.alert("Téléchargement impossible", connectionErrorMessage(err, "Vérifiez votre connexion et réessayez."));
    } finally {
      setDownloading(false);
    }
  }

  async function handleOpenPdf() {
    const uri = await getDocumentPdfUri(tokenId);
    if (!uri) return;
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    }
  }

  async function shareWithAccessLevel(accessLevel: ShareAccessLevel) {
    if (!doc) return;
    setSharing(true);
    try {
      const share = await createShare(doc.tokenId, accessLevel, 7);
      const link = `${env.apiUrl}/shares/${share.share_token}`;
      await Share.share({
        message: `Vérifiez mon document "${getDocTypeLabel(doc.docType)} · ${doc.docKey}" sur Degya : ${link}\n\nCe lien expire dans 7 jours et peut être révoqué à tout moment depuis l'onglet Partages.`,
      });
    } catch (error: any) {
      Alert.alert(
        "Partage impossible",
        error?.response?.data?.detail ?? connectionErrorMessage(error, "Vérifiez votre connexion et réessayez.")
      );
    } finally {
      setSharing(false);
    }
  }

  function handleShareLink() {
    if (!doc) return;
    Alert.alert("Partager par lien", "Que peut faire la personne qui reçoit le lien ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Consulter seulement", onPress: () => shareWithAccessLevel("view") },
      { text: "Consulter + télécharger", onPress: () => shareWithAccessLevel("download") },
    ]);
  }

  async function handleVerifyNow() {
    setVerifying(true);
    try {
      const result = await verifyByTokenId(tokenId);
      setVerifyResult(result);
    } catch {
      Alert.alert("Vérification impossible", "Vérifiez votre connexion et réessayez.");
    } finally {
      setVerifying(false);
    }
  }

  if (!doc) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.notFound}>Document introuvable dans le cache local.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.type}>{getDocTypeLabel(doc.docType)}</Text>
        <Text style={styles.key}>{doc.docKey}</Text>

        <StatusBadge isValid={verifyResult?.isValid ?? doc.isActive} isActive={verifyResult?.isValid ?? doc.isActive} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails</Text>
          {doc.attributes.map((attr) => (
            <View key={attr.key} style={styles.attrRow}>
              <Text style={styles.attrKey}>{attr.key}</Text>
              <Text style={styles.attrValue}>{formatAttributeValue(attr)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Émission</Text>
          <Text style={styles.meta}>Émis par : {doc.issuerName ?? doc.issuerAddress}</Text>
          <Text style={styles.meta}>Token #{doc.tokenId}</Text>
          <Text style={styles.meta}>CID IPFS : {doc.ipfsCid}</Text>
        </View>

        <View style={styles.actions}>
          <PrimaryButton
            label="🔍 Vérifier sur la blockchain"
            onPress={handleVerifyNow}
            loading={verifying}
            variant="secondary"
          />
          {pdfCached ? (
            <PrimaryButton label="📄 Ouvrir / partager le PDF" onPress={handleOpenPdf} variant="secondary" />
          ) : (
            <PrimaryButton label="⬇️ Télécharger le PDF" onPress={handleDownloadPdf} loading={downloading} variant="secondary" />
          )}
          <PrimaryButton
            label="📜 Historique des propriétaires"
            onPress={() => navigation.navigate("DocumentHistory", { tokenId })}
            variant="secondary"
          />
          <PrimaryButton label="🔗 Partager par QR code" onPress={() => navigation.navigate("ShareQR", { tokenId })} />
          <PrimaryButton
            label="🔒 Partage sélectif (champs choisis)"
            onPress={() => navigation.navigate("Share", { tokenId })}
            variant="secondary"
          />
          <PrimaryButton label="📤 Partager par lien" onPress={handleShareLink} loading={sharing} variant="secondary" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 20, gap: 12 },
  notFound: { padding: 24, textAlign: "center", color: "#6b7280" },
  type: { fontSize: 22, fontWeight: "800", color: "#111827" },
  key: { fontSize: 15, color: "#374151", marginBottom: 8 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#6b7280", marginBottom: 6, textTransform: "uppercase" },
  attrRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  attrKey: { color: "#374151", fontSize: 14 },
  attrValue: { color: "#111827", fontSize: 14, fontWeight: "600" },
  meta: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  actions: { marginTop: 24, gap: 10 },
});
