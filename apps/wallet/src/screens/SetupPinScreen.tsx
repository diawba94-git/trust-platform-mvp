import React, { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useWallet } from "@/context/WalletContext";

const PIN_LENGTH = 6;

export function SetupPinScreen() {
  const { createPin } = useWallet();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (pin.length < 4) {
      Alert.alert("PIN trop court", "Choisissez un code à 4 chiffres minimum.");
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert("Les codes ne correspondent pas", "Veuillez ressaisir le même code deux fois.");
      return;
    }
    setLoading(true);
    try {
      await createPin(pin);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Créer un code PIN</Text>
        <Text style={styles.subtitle}>
          Ce code protège l'ouverture de l'app sur cet appareil, en plus du verrouillage
          biométrique de votre clé privée.
        </Text>
        <TextInput
          style={styles.input}
          placeholder={`Code (${PIN_LENGTH} chiffres max)`}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={PIN_LENGTH}
          value={pin}
          onChangeText={setPin}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirmer le code"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={PIN_LENGTH}
          value={confirmPin}
          onChangeText={setConfirmPin}
        />
        <PrimaryButton label="Valider" onPress={handleSubmit} loading={loading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 24, gap: 12, marginTop: 32 },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 19 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: "center",
  },
});
