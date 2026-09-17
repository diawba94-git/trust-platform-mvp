import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "@react-navigation/native";
import type { MainTabScreenProps } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/colors";
import { verifyScannedQrCode } from "@/services/verificationService";

type Props = MainTabScreenProps<"Scan">;

/**
 * Onglet central "Scanner" : ouvre directement la caméra pour scanner le QR code d'un
 * document tiers. Le résultat affiché vient toujours de GET /documents/verify/{tokenId}
 * (jamais des données embarquées dans le QR) — voir services/verificationService.ts.
 */
export function ScanScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Réarme le scanner à chaque retour sur l'onglet (ex: après un "Réessayer").
  useFocusEffect(
    React.useCallback(() => {
      setScanLocked(false);
    }, [])
  );

  async function handleScanned(value: string) {
    if (scanLocked || loading) return;
    setScanLocked(true);
    setLoading(true);
    try {
      const outcome = await verifyScannedQrCode(value);
      if (outcome.kind === "selective") {
        navigation.navigate("VerifySelectiveResult", { result: outcome.result });
      } else {
        navigation.navigate("VerifyResult", { result: outcome.result });
      }
    } catch (error: any) {
      Alert.alert(
        "Vérification impossible",
        error?.message ?? "Ce QR code n'est pas une attestation valide, ou le réseau est indisponible.",
        [{ text: "Réessayer", onPress: () => setScanLocked(false) }]
      );
    } finally {
      setLoading(false);
    }
  }

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.hint}>Degya a besoin de l'appareil photo pour scanner un QR code.</Text>
        <PrimaryButton label="Autoriser l'appareil photo" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={(event) => handleScanned(event.data)}
      />
      <View style={styles.frame} pointerEvents="none" />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>{loading ? "Vérification en cours..." : "Cadrez le QR code d'un document"}</Text>
        <PrimaryButton
          label="Saisir un Token ID à la place"
          onPress={() => navigation.navigate("Verify")}
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: { alignItems: "center", justifyContent: "center", padding: 24, gap: 16, backgroundColor: colors.ink },
  hint: { color: colors.textOnDark, textAlign: "center", fontSize: 14, lineHeight: 20 },
  camera: { flex: 1 },
  frame: {
    position: "absolute",
    top: "28%",
    left: "15%",
    right: "15%",
    bottom: "38%",
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 20,
  },
  overlay: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center", gap: 12, paddingHorizontal: 24 },
  overlayText: {
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    overflow: "hidden",
  },
});
