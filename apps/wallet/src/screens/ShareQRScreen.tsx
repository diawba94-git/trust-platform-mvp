import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { CachedDocument } from "@trustwedge/shared";
import { getDocTypeLabel } from "@trustwedge/shared";
import type { MainStackParamList } from "@/navigation/types";
import { getLocalDocument } from "@/services/documentService";
import { getShareableQrValue } from "@/services/qrService";

type Props = NativeStackScreenProps<MainStackParamList, "ShareQR">;

export function ShareQRScreen({ route }: Props) {
  const { tokenId } = route.params;
  const [doc, setDoc] = useState<CachedDocument | null>(null);

  useEffect(() => {
    getLocalDocument(tokenId).then(setDoc);
  }, [tokenId]);

  if (!doc) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{getDocTypeLabel(doc.docType)}</Text>
        <Text style={styles.subtitle}>{doc.docKey}</Text>

        <View style={styles.qrWrapper}>
          <QRCode value={getShareableQrValue(doc)} size={240} />
        </View>

        <Text style={styles.hint}>
          Faites scanner ce QR code par la personne qui doit vérifier votre document. Son
          application relira l'état réel sur la blockchain — ce QR ne prouve rien à lui seul.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 20, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 24 },
  qrWrapper: { padding: 20, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  hint: { marginTop: 24, textAlign: "center", color: "#6b7280", fontSize: 13, lineHeight: 19 },
});
