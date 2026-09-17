import * as LocalAuthentication from "expo-local-authentication";

/**
 * Verrou rapide de l'écran d'accueil (LockScreen). C'est une vérification "présence
 * biométrique", distincte de `requireAuthentication` sur le SecureStore (keyService.ts) qui,
 * lui, protège réellement la lecture de la clé privée — la biométrie ici évite juste à
 * l'utilisateur de retaper son PIN à chaque ouverture.
 *
 * expo-local-authentication (au lieu de react-native-biometrics) : compatible Expo Go, voir
 * docs/WALLET.md pour le contexte de ce choix.
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && isEnrolled;
}

export async function promptBiometricUnlock(promptMessage = "Déverrouiller Degya"): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
  });
  return result.success;
}
