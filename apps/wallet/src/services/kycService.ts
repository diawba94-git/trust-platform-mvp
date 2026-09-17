import type { KycSubmitPayload } from "@trustwedge/shared";
import { apiClient } from "./sdk";

/**
 * Fine couche au-dessus du SDK pour l'onboarding KYC (cf. routers/verification.py côté
 * backend) — téléphone/email réels (JWT à expiration), envoi mocké ; OCR carte d'identité
 * réel (Tesseract) ; comparaison faciale mockée. Voir docs/WALLET.md.
 */
export const sendPhoneCode = (phone: string) => apiClient.sendPhoneVerificationCode(phone);
export const verifyPhoneCode = (token: string, code: string) => apiClient.verifyPhoneCode(token, code);
export const sendEmailVerification = (email: string) => apiClient.sendEmailVerification(email);
export const verifyEmailToken = (token: string) => apiClient.verifyEmailToken(token);
export const extractIdCardFields = (imageBase64: string) => apiClient.extractIdCardFields(imageBase64);
export const compareFaces = (cardImageBase64: string, selfieImageBase64: string) =>
  apiClient.compareFaces(cardImageBase64, selfieImageBase64);
/** Persiste le dossier complet une fois les 4 étapes franchies — voir routers/kyc.py. */
export const submitKyc = (payload: KycSubmitPayload) => apiClient.submitKyc(payload);
