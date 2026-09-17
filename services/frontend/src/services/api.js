import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const client = axios.create({ baseURL: API_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// FastAPI renvoie `detail` sous forme de texte pour les erreurs métier (HTTPException),
// mais sous forme de tableau d'objets {loc, msg, ...} pour les erreurs de validation (422) —
// sans ce traitement, ces dernières s'afficheraient comme "[object Object]".
function formatErrorDetail(detail) {
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(' ; ');
  }
  return detail;
}

function unwrap(promise) {
  return promise
    .then((res) => res.data)
    .catch((err) => {
      const message =
        formatErrorDetail(err.response?.data?.detail) ||
        err.message ||
        'Erreur réseau — vérifiez votre connexion et réessayez.';
      throw new Error(message);
    });
}

export function login(email, password) {
  return unwrap(client.post('/auth/login', { email, password }));
}

export function register(userData) {
  return unwrap(client.post('/auth/register', userData));
}

export function verifyDocument(tokenId) {
  return unwrap(client.get(`/documents/verify/${tokenId}`));
}

export function getMyDocuments() {
  return unwrap(client.get('/documents/my'));
}

export function issueDocument(data) {
  return unwrap(client.post('/documents/issue', data));
}

export function getUsers(role, mine, q) {
  const params = {};
  if (role) params.role = role;
  if (mine) params.mine = true;
  if (q) params.q = q;
  return unwrap(client.get('/users', { params }));
}

export function getMyWorkflows(status) {
  return unwrap(client.get('/workflows/my', { params: status ? { status } : {} }));
}

export function createWorkflow(data) {
  return unwrap(client.post('/workflows/create', data));
}

export function startWorkflow(workflowId) {
  return unwrap(client.post(`/workflows/${workflowId}/start`));
}

export function requestVerification({ workflow_id, verifier_id, verification_data }) {
  return unwrap(
    client.post(`/workflows/${workflow_id}/request-verification`, {
      verifier_id,
      verification_data,
    })
  );
}

// Enchaîne create -> start -> request-verification : le point d'entrée
// utilisé par l'acteur qui initie une demande (ex: le titulaire d'un document) vers un vérificateur.
export async function initiateWorkflow({ workflow_type, target_user_id, document_token_id, workflow_data }) {
  const created = await createWorkflow({
    workflow_type,
    target_user_id,
    document_token_id,
    workflow_data,
  });
  await startWorkflow(created.workflow_id);
  return requestVerification({
    workflow_id: created.workflow_id,
    verifier_id: target_user_id,
    verification_data: workflow_data,
  });
}

export function submitVerification({ workflow_id, is_valid, notes }) {
  return unwrap(
    client.post(`/workflows/${workflow_id}/submit-verification`, { is_valid, notes })
  );
}

export function validateByNotary({ workflow_id, is_valid, notes, transaction_hash }) {
  return unwrap(
    client.post(`/workflows/${workflow_id}/validate-by-notary`, {
      is_valid,
      notes,
      transaction_hash,
    })
  );
}

export function getDocumentVersions(tokenId) {
  return unwrap(client.get(`/documents/${tokenId}/versions`));
}

export function getOwnerAtTimestamp(tokenId, timestamp) {
  return unwrap(client.get(`/documents/${tokenId}/owner-at`, { params: { timestamp } }));
}

export function downloadDocument(cid) {
  return unwrap(client.get(`/documents/download/${cid}`, { responseType: 'blob' }));
}

// Vérifie un fichier sans Token ID : le document est retrouvé automatiquement à partir de
// son empreinte IPFS (mapping on-chain hashToTokenId), pas besoin de le saisir.
export function verifyDocumentAuto(file) {
  const formData = new FormData();
  formData.append('file', file);
  return unwrap(
    client.post('/documents/verify-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  );
}

// Vérifie qu'un fichier fourni par l'utilisateur correspond bien au contenu enregistré
// on-chain pour ce token_id (détection de falsification).
export function verifyDocumentFile(tokenId, file) {
  const formData = new FormData();
  formData.append('file', file);
  return unwrap(
    client.post(`/documents/${tokenId}/verify-file`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  );
}

// ADMIN uniquement : liste tous les documents enregistrés (pour retrouver un Token ID).
export function getAllDocuments() {
  return unwrap(client.get('/admin/documents'));
}

// Documents émis par l'utilisateur courant (ADMIN/NOTARY voient tout le registre) —
// alimente les widgets "récemment émis" des tableaux de bord Université/Entreprise/État.
export function getIssuedDocuments(docType) {
  return unwrap(client.get('/documents/issued', { params: docType ? { doc_type: docType } : {} }));
}

// Statistiques agrégées du tableau de bord — la forme de la réponse dépend du rôle appelant.
export function getStatsOverview() {
  return unwrap(client.get('/stats/overview'));
}

// ADMIN uniquement : fil d'activité récente, tous rôles confondus.
export function getRecentActivity(limit) {
  return unwrap(client.get('/stats/activity', { params: limit ? { limit } : {} }));
}

// ADMIN uniquement : statut du réseau blockchain (bloc courant, connexion).
export function getNetworkStatus() {
  return unwrap(client.get('/network/status'));
}

// ADMIN uniquement : lit un fichier par OCR et propose une extraction des champs du titre
// foncier (référence, localisation, superficie, valeur) — purement indicatif, rien n'est
// enregistré ; à vérifier/corriger avant import.
export function ocrExtractLandTitle(file) {
  const formData = new FormData();
  formData.append('file', file);
  return unwrap(
    client.post('/admin/land-titles/ocr-extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  );
}

// ADMIN uniquement : émet un NOUVEAU titre foncier en important son fichier existant
// (scan d'un titre déjà délivré) plutôt qu'en générant un PDF à partir d'attributs.
export function importLandTitle({ ownerEmail, docKey, location, landArea, value, isTransferable, file }) {
  const formData = new FormData();
  formData.append('owner_email', ownerEmail);
  formData.append('doc_key', docKey);
  formData.append('location', location);
  formData.append('land_area', landArea);
  formData.append('value', value);
  formData.append('is_transferable', isTransferable);
  formData.append('file', file);
  return unwrap(
    client.post('/admin/land-titles/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  );
}

export function getMyCredentials() {
  return unwrap(client.get('/did/my'));
}

export function regeneratePrivateKey() {
  return unwrap(client.post('/did/regenerate'));
}

export function getWorkflowStatus(workflowId) {
  return unwrap(client.get(`/workflows/${workflowId}/status`));
}

// ============================================================
// Vente entre particuliers (triple signature vendeur/acheteur/notaire)
// ============================================================
export function initiateTransfer({ token_id, buyer_email }) {
  return unwrap(client.post('/workflows/transfer/initiate', { token_id, buyer_email }));
}

export function acceptTransfer({ workflow_id }) {
  return unwrap(client.post('/workflows/transfer/accept', { workflow_id }));
}

export function finalizeTransfer({ workflow_id, notes }) {
  return unwrap(client.post('/workflows/transfer/notary-finalize', { workflow_id, notes }));
}

// ============================================================
// Notifications
// ============================================================
export function getNotifications() {
  return unwrap(client.get('/notifications'));
}

export function markNotificationAsRead(notificationId) {
  return unwrap(client.post(`/notifications/${notificationId}/read`));
}

export function markAllNotificationsAsRead() {
  return unwrap(client.post('/notifications/read-all'));
}

export function deleteAllNotifications() {
  return unwrap(client.delete('/notifications'));
}

// ADMIN uniquement : vue globale de tous les workflows (toutes parties confondues).
export function getAllWorkflows(type) {
  return unwrap(client.get('/admin/workflows', { params: type ? { type } : {} }));
}

// ISSUER (étudiant) ou VERIFIER (employé) uniquement : crée un compte USER et son DID (ou
// rattache la personne à cet établissement si son DID existe déjà — cf. already_existed).
export function createManagedUser({ email, full_name, first_name, last_name, date_of_birth, place_of_birth, national_id_number, role }) {
  return unwrap(client.post('/actors/create-managed-user', {
    email, full_name, first_name, last_name, date_of_birth, place_of_birth, national_id_number, role,
  }));
}

// Partages créés par l'utilisateur courant depuis le wallet mobile (gestion en lecture +
// révocation côté web — la création d'un partage reste une action mobile, liée à un document).
export function getMyShares() {
  return unwrap(client.get('/shares/mine'));
}

export function revokeShare(shareToken) {
  return unwrap(client.delete(`/shares/${shareToken}`));
}

// BANK/NOTARY uniquement : dossiers KYC soumis par le wallet mobile, à revoir.
export function getPendingKyc(status) {
  return unwrap(client.get('/verification/kyc/pending', { params: status ? { status } : {} }));
}

export function reviewKyc(kycId, approve, notes) {
  return unwrap(client.post(`/verification/kyc/${kycId}/review`, { approve, notes }));
}

export function getMyKycStatus() {
  return unwrap(client.get('/verification/kyc/mine'));
}

export default client;
