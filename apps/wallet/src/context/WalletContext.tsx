import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { WalletIdentity } from "@trustwedge/shared";
import * as authService from "@/services/authService";
import * as pinService from "@/services/pinService";
import { saveIdentity } from "@/services/storageService";

type WalletStatus = "loading" | "not_linked" | "needs_pin_setup" | "locked" | "unlocked";

interface WalletContextValue {
  status: WalletStatus;
  identity: WalletIdentity | null;
  /** true seulement juste après registerAccount() — gate le passage par KycVerificationScreen
   * avant SetupPin. Un compte importé (linkAccount) n'y passe pas (déjà provisionné par un admin). */
  needsKyc: boolean;
  linkAccount: (email: string, password: string) => Promise<void>;
  registerAccount: (email: string, password: string, fullName: string) => Promise<void>;
  completeKyc: () => Promise<void>;
  createPin: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithoutChallenge: () => void; // après succès biométrique (LockScreen)
  lock: () => void;
  wipeWallet: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("loading");
  const [identity, setIdentity] = useState<WalletIdentity | null>(null);
  const [needsKyc, setNeedsKyc] = useState(false);

  const bootstrap = useCallback(async () => {
    try {
      const linked = await authService.isWalletLinked();
      if (!linked) {
        setStatus("not_linked");
        return;
      }
      const savedIdentity = await authService.getLinkedIdentity();
      setIdentity(savedIdentity);
      const pinConfigured = await pinService.hasPin();
      setStatus(pinConfigured ? "locked" : "needs_pin_setup");
    } catch (error) {
      // Sans ce filet, la moindre erreur ici (SecureStore, ...) laisse status bloqué sur
      // "loading" indéfiniment — l'app reste figée sans aucun retour visible à l'écran.
      console.error("Échec du bootstrap du wallet, retour à l'écran d'accueil :", error);
      setStatus("not_linked");
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const linkAccount = useCallback(async (email: string, password: string) => {
    const savedIdentity = await authService.linkExistingAccount(email, password);
    setIdentity(savedIdentity);
    setNeedsKyc(false);
    setStatus("needs_pin_setup");
  }, []);

  const registerAccount = useCallback(async (email: string, password: string, fullName: string) => {
    const savedIdentity = await authService.registerNewAccount(email, password, fullName);
    setIdentity(savedIdentity);
    setNeedsKyc(true);
    setStatus("needs_pin_setup");
  }, []);

  const completeKyc = useCallback(async () => {
    setIdentity((current) => {
      if (!current) return current;
      const next = { ...current, kycVerifiedAt: new Date().toISOString() };
      saveIdentity(next);
      return next;
    });
    setNeedsKyc(false);
  }, []);

  const createPin = useCallback(async (pin: string) => {
    await pinService.setPin(pin);
    setStatus("unlocked");
  }, []);

  const unlockWithPin = useCallback(async (pin: string) => {
    const valid = await pinService.verifyPin(pin);
    if (valid) setStatus("unlocked");
    return valid;
  }, []);

  const unlockWithoutChallenge = useCallback(() => {
    setStatus("unlocked");
  }, []);

  const lock = useCallback(() => {
    setStatus((current) => (current === "unlocked" ? "locked" : current));
  }, []);

  const wipeWallet = useCallback(async () => {
    await authService.unlinkWallet();
    setIdentity(null);
    setNeedsKyc(false);
    setStatus("not_linked");
  }, []);

  const value = useMemo(
    () => ({
      status,
      identity,
      needsKyc,
      linkAccount,
      registerAccount,
      completeKyc,
      createPin,
      unlockWithPin,
      unlockWithoutChallenge,
      lock,
      wipeWallet,
    }),
    [
      status,
      identity,
      needsKyc,
      linkAccount,
      registerAccount,
      completeKyc,
      createPin,
      unlockWithPin,
      unlockWithoutChallenge,
      lock,
      wipeWallet,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
