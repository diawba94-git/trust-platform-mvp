/**
 * Pas de refresh token côté backend (JWT_EXPIRATION=3600s, cf. sessionService.ts) : passé ce
 * délai, le wallet n'envoie plus d'en-tête Authorization (getValidToken() renvoie null) et
 * l'API répond 401/403 — un message générique "vérifiez votre connexion" serait trompeur dans
 * ce cas précis, puisque le vrai problème est une session expirée, pas le réseau.
 */
export function connectionErrorMessage(err: any, fallback: string): string {
  const status = err?.response?.status;
  if (status === 401 || status === 403) {
    return "Session expirée — reconnectez-vous depuis Profil.";
  }
  return fallback;
}
