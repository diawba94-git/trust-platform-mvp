/**
 * Palette DEGYA — reprise des maquettes (bandeau/fond sombre indigo, accent violet-indigo,
 * cartes de documents colorées par catégorie via @trustwedge/shared:DOC_TYPE_META).
 */
export const colors = {
  // Fond sombre (en-tête, écran de verrouillage, onboarding).
  ink: "#1E1B3A",
  inkSoft: "#2D2A54",
  // Accent principal (boutons, éléments actifs).
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  primaryLight: "#EEF2FF",
  // Fond général de l'app / cartes.
  background: "#F5F6FA",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  // Texte.
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textOnDark: "#FFFFFF",
  textOnDarkMuted: "#C7C4E8",
  // États.
  success: "#059669",
  successBg: "#D1FAE5",
  danger: "#DC2626",
  dangerBg: "#FEE2E2",
  warning: "#D97706",
  warningBg: "#FEF3C7",
} as const;
