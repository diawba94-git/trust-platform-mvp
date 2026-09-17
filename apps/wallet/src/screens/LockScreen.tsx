import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/colors";
import { useWallet } from "@/context/WalletContext";
import { isBiometricsAvailable, promptBiometricUnlock } from "@/services/biometricService";

export function LockScreen() {
  const { unlockWithPin, unlockWithoutChallenge, identity } = useWallet();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);

  useEffect(() => {
    isBiometricsAvailable().then(setBiometricsAvailable);
  }, []);

  async function handlePinSubmit() {
    setLoading(true);
    try {
      const ok = await unlockWithPin(pin);
      if (!ok) {
        setPin("");
        Alert.alert("Code incorrect", "Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleBiometricUnlock() {
    const success = await promptBiometricUnlock();
    if (success) unlockWithoutChallenge();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🔒 Degya</Text>
        {identity && <Text style={styles.subtitle}>{identity.fullName}</Text>}
        <TextInput
          style={styles.input}
          placeholder="Code PIN"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          value={pin}
          onChangeText={setPin}
          onSubmitEditing={handlePinSubmit}
        />
        <PrimaryButton label="Déverrouiller" onPress={handlePinSubmit} loading={loading} />
        {biometricsAvailable && (
          <PrimaryButton label="Utiliser Face ID / empreinte" onPress={handleBiometricUnlock} variant="secondary" />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink, justifyContent: "center" },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: "800", color: colors.textOnDark, textAlign: "center" },
  subtitle: { fontSize: 14, color: colors.textOnDarkMuted, textAlign: "center", marginBottom: 12 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: "center",
  },
});
