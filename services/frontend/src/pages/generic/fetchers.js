// Fonctions de récupération de données pour les instances de GenericListPage — définies en
// dehors du rendu, une seule fois, pour garder une identité de fonction stable (évite de
// re-déclencher le useEffect de GenericListPage à chaque rendu du parent, cf. App.js).
import { getUsers, getIssuedDocuments, getAllDocuments, getAllWorkflows, getMyWorkflows, getMyDocuments } from '../../services/api';

const WORKFLOW_TYPE_LABELS = {
  DIPLOMA_VERIFICATION: 'Demande de vérification',
  LOAN_APPLICATION: 'Demande de prêt',
  LAND_TRANSFER: 'Vente de titre foncier',
  EMPLOYMENT_VERIFICATION: "Vérification d'emploi",
  ID_CARD_ISSUANCE: "Émission de carte d'identité",
};
const WORKFLOW_STATUS_LABELS = {
  PENDING: 'En attente', IN_PROGRESS: 'En cours', AWAITING_VERIFICATION: 'En attente',
  AWAITING_NOTARY: 'En attente', COMPLETED: 'Approuvée', REJECTED: 'Rejetée', CANCELLED: 'Annulée',
};

export const fetchAllUsers = () => getUsers();
export const fetchBanks = () => getUsers('BANK');
export const fetchNotaries = () => getUsers('NOTARY');
export const fetchUniversities = () => getUsers('ISSUER');
export const fetchEmployeesRole = () => getUsers('VERIFIER');
export const fetchCitizens = () => getUsers('USER');
export const fetchMyEmployees = () => getUsers('USER', true);
export const fetchMyStudents = () => getUsers('USER', true);

export const fetchDiplomas = () => getIssuedDocuments('DIPLOMA');
export const fetchAttestations = () => getIssuedDocuments('EMPLOYMENT');
export const fetchAdminAttestations = () =>
  getAllDocuments().then((docs) => docs.filter((d) => !['LAND_TITLE', 'DIPLOMA'].includes(d.doc_type)));
export const fetchAdminLandTransfers = () => getAllWorkflows('LAND_TRANSFER');
export const fetchAllWorkflows = () => getAllWorkflows();

export const fetchNotarizedActs = () =>
  getMyWorkflows().then((wf) => wf.filter((w) => w.type === 'LAND_TRANSFER' && w.status === 'COMPLETED'));

export const fetchMyLandTitles = () => getMyDocuments().then((docs) => docs.filter((d) => d.doc_type === 'LAND_TITLE'));
export const fetchMyDiplomas = () => getMyDocuments().then((docs) => docs.filter((d) => d.doc_type === 'DIPLOMA'));
export const fetchMyAttestations = () => getMyDocuments().then((docs) => docs.filter((d) => d.doc_type === 'EMPLOYMENT'));
export const fetchMyIdCards = () => getMyDocuments().then((docs) => docs.filter((d) => d.doc_type === 'ID_CARD'));
export const fetchMyAllDocuments = () => getMyDocuments();

function withTargetNames(workflows) {
  return getUsers().then((users) => {
    const byId = Object.fromEntries(users.map((u) => [u.id, u.full_name]));
    return workflows.map((w) => ({
      ...w,
      type: WORKFLOW_TYPE_LABELS[w.type] || w.type,
      status: WORKFLOW_STATUS_LABELS[w.status] || w.status,
      target: byId[w.target_user_id] || '—',
    }));
  });
}

export const fetchMyRequests = () =>
  getMyWorkflows().then((wfs) => withTargetNames(wfs.filter((w) => w.type !== 'LAND_TRANSFER')));

export const fetchMyOffers = () =>
  getMyWorkflows().then((wfs) => withTargetNames(
    wfs.filter((w) => w.type === 'LAND_TRANSFER' && w.status === 'AWAITING_VERIFICATION'),
  ));
