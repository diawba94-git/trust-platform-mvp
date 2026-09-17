// Thème visuel + navigation par rôle. Couleur d'accent canonique par rôle (une seule par
// rôle, précisée explicitement par le client) : Admin #4f46e5 · Université #7c3aed ·
// Entreprise #0891b2 · Banque #2563eb · Notaire #059669 · Utilisateur #4f46e5.
export const ROLE_THEMES = {
  ADMIN: {
    badge: null,
    roleLabel: 'Super Administrateur',
    accent: '#4f46e5',
    menu: [
      { label: 'Console technique', icon: 'settings', path: '/console' },
      { section: 'GESTION DES IDENTITÉS' },
      { label: 'Créer un acteur', icon: 'person_add', path: '/admin/create-actor' },
      { section: 'TITRES & DOCUMENTS' },
      { label: 'Titres fonciers', icon: 'description', path: '/admin/land-titles' },
    ],
  },
  ISSUER: {
    badge: null,
    roleLabel: 'Administrateur',
    accent: '#7c3aed',
    institution: true,
    menu: [
      { label: 'Console technique', icon: 'settings', path: '/console' },
      { section: 'IDENTITÉ ACADÉMIQUE' },
      { label: 'Émettre un diplôme', icon: 'school', path: '/university/issue' },
      { label: 'Établir DID', icon: 'badge', path: '/university/create-did' },
      { section: 'ADMINISTRATION' },
      { label: 'Vérifier un document', icon: 'verified', path: '/university/verify' },
      { label: 'Demandes de vérification', icon: 'fact_check', path: '/university/requests' },
    ],
  },
  VERIFIER: {
    badge: 'ENTREPRISE',
    roleLabel: 'Responsable RH',
    accent: '#0891b2',
    menu: [
      { label: 'Console technique', icon: 'settings', path: '/console' },
      { section: 'IDENTITÉ' },
      { label: 'Établir DID', icon: 'badge', path: '/company/create-did' },
      { label: 'Attestation employeur', icon: 'description', path: '/company/issue' },
      { section: 'ADMINISTRATION' },
      { label: 'Vérifier un document', icon: 'verified', path: '/company/verify' },
      { label: 'Demandes de vérifications', icon: 'fact_check', path: '/company/requests' },
    ],
  },
  BANK: {
    badge: 'BANQUE',
    roleLabel: 'Responsable Conformité',
    accent: '#2563eb',
    menu: [
      { label: 'Console technique', icon: 'settings', path: '/console' },
      { section: 'CLIENTS' },
      { label: 'Établir DID', icon: 'badge', path: '/bank/create-did' },
      { label: 'Demandes de prêt', icon: 'request_quote', path: '/bank/loans' },
      { label: 'Demandes KYC', icon: 'groups2', path: '/bank/kyc' },
      { section: 'ADMINISTRATION' },
      { label: 'Vérifier un document', icon: 'verified', path: '/bank/verify' },
    ],
  },
  NOTARY: {
    badge: 'NOTAIRE',
    roleLabel: 'Notaire',
    accent: '#059669',
    menu: [
      { label: 'Console technique', icon: 'settings', path: '/console' },
      { section: 'ACTES NOTARIÉS' },
      { label: 'Enregistrer un titre', icon: 'description', path: '/state/register' },
      { label: 'Transferts en cours', icon: 'sync_alt', path: '/state/transfers' },
      { label: 'Signatures en attente', icon: 'fact_check', path: '/state/signatures' },
      { section: 'CONTRÔLES' },
      { label: 'Vérifications', icon: 'groups2', path: '/state/verifications' },
      { label: 'Vérifier un document', icon: 'verified', path: '/state/verify' },
    ],
  },
  USER: {
    badge: 'UTILISATEUR',
    badgeSoft: true,
    roleLabel: 'Utilisateur',
    accent: '#4f46e5',
    menu: [
      { label: 'Console technique', icon: 'settings', path: '/console' },
      { label: 'Mon identité', icon: 'badge', path: '/profile' },
      { label: 'Mes documents', icon: 'folder', path: '/dashboard/documents/all' },
      { label: 'Mes partages', icon: 'share', path: '/dashboard/shares' },
      { label: 'Notifications', icon: 'notifications', path: '/notifications' },
      { section: 'ACTIONS' },
      { label: 'Demander une vérification', icon: 'verified', path: '/dashboard/documents' },
      { label: 'Mettre en vente un titre', icon: 'sell', path: '/dashboard/sell-title' },
      { label: 'Vérifier un document', icon: 'verified', path: '/dashboard/verify' },
    ],
  },
};

export function getRoleTheme(role) {
  return ROLE_THEMES[role] || ROLE_THEMES.USER;
}
