import React, { useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { IdCardFields } from "@trustwedge/shared";
import type { AuthStackParamList } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useWallet } from "@/context/WalletContext";
import * as kycService from "@/services/kycService";

type Step = 1 | 2 | 3 | 4;
type Props = NativeStackScreenProps<AuthStackParamList, "KycVerification">;

/**
 * Onboarding SSI en 4 étapes, uniquement pour un DID nouvellement créé (RegisterScreen →
 * ici → SetupPin ; cf. WalletContext.needsKyc). Téléphone/email vérifiés pour de vrai côté
 * backend (JWT à expiration) mais l'envoi est mocké — voir docs/WALLET.md pour le détail de
 * ce qui est réel (OCR) vs simulé (SMS/email/reconnaissance faciale) dans cette première passe.
 */
export function KycVerificationScreen({ navigation }: Props) {
  const { completeKyc, identity } = useWallet();
  const [step, setStep] = useState<Step>(1);
  const [cardImageBase64, setCardImageBase64] = useState<string | null>(null);
  const [idCardFields, setIdCardFields] = useState<IdCardFields | null>(null);

  async function handleFinish(faceMatchPassed: boolean) {
    // Persiste le dossier pour une revue humaine (Banque/Notaire côté web) — best-effort :
    // une erreur réseau ici ne doit pas bloquer la création de l'identité locale, déjà faite.
    // `faceMatchPassed` est reçu en paramètre (pas relu depuis un state) car un state tout
    // juste posé par l'appelant ne serait pas encore visible ici (mise à jour asynchrone).
    try {
      const fullName = [idCardFields?.prenom, idCardFields?.nom].filter(Boolean).join(" ") || identity?.email || "Inconnu";
      await kycService.submitKyc({
        full_name: fullName,
        id_card_number: idCardFields?.num_cni,
        id_card_data: idCardFields ? { ...idCardFields } : {},
        phone_verified: true,
        email_verified: true,
        face_match_passed: faceMatchPassed,
      });
    } catch {
      // Non bloquant — voir commentaire ci-dessus.
    }
    await completeKyc();
    navigation.replace("SetupPin");
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.header}>Vérification d'identité</Text>
        <Text style={styles.headerSub}>Quelques étapes avant de créer votre identité numérique</Text>

        <View style={styles.stepIndicator}>
          {[1, 2, 3, 4].map((s) => (
            <View key={s} style={[styles.dot, s === step && styles.dotActive, s < step && styles.dotDone]} />
          ))}
        </View>

        {step === 1 && <PhoneStep onDone={() => setStep(2)} />}
        {step === 2 && <EmailStep defaultEmail={identity?.email} onDone={() => setStep(3)} />}
        {step === 3 && (
          <IdCardStep
            onDone={(base64, fields) => {
              setCardImageBase64(base64);
              setIdCardFields(fields);
              setStep(4);
            }}
          />
        )}
        {step === 4 && cardImageBase64 && (
          <SelfieStep cardImageBase64={cardImageBase64} onDone={handleFinish} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================
// Étape 1 — Téléphone
// ============================================================
function PhoneStep({ onDone }: { onDone: () => void }) {
  const [phone, setPhone] = useState("+221 ");
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const result = await kycService.sendPhoneCode(phone);
      setToken(result.token);
      if (result.dev_code) setCode(result.dev_code); // mode démo : auto-rempli, cf. docs/WALLET.md
      Alert.alert("Code envoyé", "Un code à 6 chiffres a été envoyé par SMS.");
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le code — vérifiez votre connexion.");
    } finally {
      setSending(false);
    }
  }

  async function handleVerify() {
    if (!token) return;
    setVerifying(true);
    try {
      const result = await kycService.verifyPhoneCode(token, code);
      if (result.verified) {
        onDone();
      } else {
        Alert.alert("Code invalide", "Vérifiez le code reçu et réessayez.");
      }
    } catch {
      Alert.alert("Erreur", "Vérification impossible — vérifiez votre connexion.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📱 Vérification du téléphone</Text>
      <TextInput style={styles.input} placeholder="+221 77 123 45 67" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <PrimaryButton label="Envoyer le code" onPress={handleSend} loading={sending} variant="secondary" />

      <Text style={styles.label}>Code reçu ?</Text>
      <TextInput
        style={[styles.input, styles.codeInput]}
        placeholder="••••••"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        editable={!!token}
      />
      {token && !!code && (
        <Text style={styles.hint}>Code pré-rempli automatiquement (mode démo — pas d'envoi SMS réel).</Text>
      )}
      <PrimaryButton label="✅ Vérifier" onPress={handleVerify} loading={verifying} disabled={!token || code.length < 4} />
    </View>
  );
}

// ============================================================
// Étape 2 — Email
// ============================================================
function EmailStep({ defaultEmail, onDone }: { defaultEmail?: string; onDone: () => void }) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [token, setToken] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function handleSend() {
    if (!email) {
      Alert.alert("Email manquant", "Renseignez votre adresse email.");
      return;
    }
    setSending(true);
    try {
      const result = await kycService.sendEmailVerification(email);
      setToken(result.token);
      Alert.alert("Email envoyé", "Un lien de confirmation a été envoyé (mode démo : voir les logs serveur).");
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer l'email — vérifiez votre connexion.");
    } finally {
      setSending(false);
    }
  }

  async function handleConfirm() {
    if (!token) return;
    setVerifying(true);
    try {
      const result = await kycService.verifyEmailToken(token);
      if (result.verified) {
        onDone();
      } else {
        Alert.alert("Lien invalide", "Le lien a peut-être expiré — renvoyez un email.");
      }
    } catch {
      Alert.alert("Erreur", "Vérification impossible — vérifiez votre connexion.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📧 Vérification de l'email</Text>
      <TextInput
        style={styles.input}
        placeholder="jean@exemple.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <PrimaryButton label="Envoyer le lien" onPress={handleSend} loading={sending} variant="secondary" />
      {token && <Text style={styles.hint}>Lien envoyé — en mode démo, aucun email réel n'est expédié (cf. logs du backend).</Text>}
      <PrimaryButton label="Je confirme mon email" onPress={handleConfirm} loading={verifying} disabled={!token} />
    </View>
  );
}

// ============================================================
// Étape 3 — Carte d'identité (OCR réel côté backend)
// ============================================================
function IdCardStep({ onDone }: { onDone: (cardImageBase64: string, fields: IdCardFields) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [fields, setFields] = useState<IdCardFields | null>(null);
  const [scanning, setScanning] = useState(false);

  async function handleScan() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.6 });
    if (!photo?.base64) return;

    setPhotoUri(photo.uri);
    setPhotoBase64(photo.base64);
    setScanning(true);
    try {
      const extracted = await kycService.extractIdCardFields(photo.base64);
      setFields(extracted);
    } catch {
      Alert.alert("Erreur", "Extraction impossible — vérifiez votre connexion. Vous pouvez saisir les champs à la main.");
      setFields({ nom: "", prenom: "", date_naissance: "", num_cni: "", nationalite: "" });
    } finally {
      setScanning(false);
    }
  }

  function updateField(key: keyof IdCardFields, value: string) {
    setFields((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>🪪 Scan de la carte d'identité</Text>

      {!photoUri ? (
        permission?.granted === false ? (
          <PrimaryButton label="Autoriser l'appareil photo" onPress={requestPermission} />
        ) : (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            <PrimaryButton label="📷 Scanner" onPress={handleScan} loading={scanning} />
          </>
        )
      ) : (
        <>
          <Text style={styles.hint}>Photo prise ✓ — vérifiez et corrigez si besoin les champs extraits.</Text>
          {fields && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Informations extraites</Text>
              <LabeledInput label="Nom" value={fields.nom} onChangeText={(v) => updateField("nom", v)} />
              <LabeledInput label="Prénom" value={fields.prenom} onChangeText={(v) => updateField("prenom", v)} />
              <LabeledInput label="Date de naissance" value={fields.date_naissance} onChangeText={(v) => updateField("date_naissance", v)} />
              <LabeledInput label="Numéro CNI" value={fields.num_cni} onChangeText={(v) => updateField("num_cni", v)} />
              <LabeledInput label="Nationalité" value={fields.nationalite} onChangeText={(v) => updateField("nationalite", v)} />
            </View>
          )}
          <PrimaryButton
            label="✅ Valider les informations"
            onPress={() => photoBase64 && fields && onDone(photoBase64, fields)}
            disabled={scanning || !fields}
          />
        </>
      )}
    </View>
  );
}

// ============================================================
// Étape 4 — Selfie + comparaison faciale (mockée côté backend)
// ============================================================
function SelfieStep({ cardImageBase64, onDone }: { cardImageBase64: string; onDone: (faceMatchPassed: boolean) => Promise<void> }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<{ matched: boolean; similarity: number } | null>(null);
  const [finishing, setFinishing] = useState(false);

  async function handleSelfie() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) return;
    }
    const photo = await cameraRef.current?.takePictureAsync({ base64: true, quality: 0.6 });
    if (!photo?.base64) return;

    setSelfieUri(photo.uri);
    setComparing(true);
    try {
      const compared = await kycService.compareFaces(cardImageBase64, photo.base64);
      setResult(compared);
    } catch {
      Alert.alert("Erreur", "Comparaison impossible — vérifiez votre connexion.");
    } finally {
      setComparing(false);
    }
  }

  async function handleCreate() {
    setFinishing(true);
    try {
      await onDone(result?.matched ?? false);
    } finally {
      setFinishing(false);
    }
  }

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>📸 Photo et identification</Text>

      {!selfieUri ? (
        permission?.granted === false ? (
          <PrimaryButton label="Autoriser l'appareil photo" onPress={requestPermission} />
        ) : (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="front" />
            <PrimaryButton label="📸 Prendre mon selfie" onPress={handleSelfie} loading={comparing} />
          </>
        )
      ) : (
        <>
          {result && (
            <View style={styles.card}>
              <Text style={[styles.matchText, result.matched ? styles.matchOk : styles.matchKo]}>
                {result.matched ? "✅ Correspondance validée" : "❌ Correspondance insuffisante"} ({result.similarity}%)
              </Text>
              <Text style={styles.mockNotice}>
                Comparaison simulée dans cette version (pas de reconnaissance faciale réelle branchée).
              </Text>
            </View>
          )}
          {result?.matched ? (
            <PrimaryButton label="✅ Créer mon identité numérique" onPress={handleCreate} loading={finishing} />
          ) : (
            result && <PrimaryButton label="Reprendre le selfie" onPress={() => setSelfieUri(null)} variant="secondary" />
          )}
        </>
      )}
    </View>
  );
}

function LabeledInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.fieldInput} value={value} onChangeText={onChangeText} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { fontSize: 22, fontWeight: "800", color: "#111827", textAlign: "center" },
  headerSub: { fontSize: 13, color: "#6b7280", textAlign: "center", marginTop: 4, marginBottom: 20 },
  stepIndicator: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#e5e7eb" },
  dotActive: { backgroundColor: "#111827", width: 14, height: 14, borderRadius: 7 },
  dotDone: { backgroundColor: "#059669" },
  stepContent: { gap: 10 },
  stepTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 4 },
  label: { fontSize: 13, color: "#6b7280", marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 10, padding: 14, fontSize: 15 },
  codeInput: { textAlign: "center", letterSpacing: 8, fontSize: 20 },
  hint: { fontSize: 12, color: "#6b7280", fontStyle: "italic" },
  camera: { width: "100%", height: 260, borderRadius: 12, overflow: "hidden", backgroundColor: "#000" },
  card: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 16, gap: 8 },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", marginBottom: 4 },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 12, color: "#6b7280" },
  fieldInput: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: "#fff" },
  matchText: { fontSize: 16, fontWeight: "800", textAlign: "center" },
  matchOk: { color: "#059669" },
  matchKo: { color: "#b3261e" },
  mockNotice: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 4 },
});
