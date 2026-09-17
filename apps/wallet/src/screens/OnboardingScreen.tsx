import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "@/navigation/types";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors } from "@/theme/colors";

type Props = NativeStackScreenProps<AuthStackParamList, "Onboarding">;

export function OnboardingScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>🌍 Degya</Text>
        <Text style={styles.subtitle}>
          Gardez vos attestations (titres fonciers, diplômes, cartes d'identité...) sur votre
          téléphone, chiffrées, et partagez-les par QR code.
        </Text>
        <View style={styles.bullets}>
          <Text style={styles.bullet}>• Votre clé privée reste sur cet appareil, protégée par le Keychain/Keystore et un PIN.</Text>
          <Text style={styles.bullet}>• Chaque vérification relit l'état réel sur la blockchain — jamais une simple copie locale.</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="Se connecter à mon compte Degya" onPress={() => navigation.navigate("Login")} />
        <PrimaryButton
          label="Je n'ai pas de compte — créer mon DID"
          onPress={() => navigation.navigate("Register")}
          variant="secondary"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.ink, justifyContent: "space-between" },
  content: { padding: 24, marginTop: 48 },
  title: { fontSize: 32, fontWeight: "800", color: colors.textOnDark },
  subtitle: { fontSize: 15, color: colors.textOnDarkMuted, marginTop: 16, lineHeight: 22 },
  bullets: { marginTop: 24 },
  bullet: { fontSize: 13, color: colors.textOnDarkMuted, marginTop: 8, lineHeight: 19 },
  actions: { padding: 24, gap: 10 },
});
