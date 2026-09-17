import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';

import Login from './pages/Login';
import DocumentHistory from './pages/DocumentHistory';
import TransferSign from './pages/TransferSign';
import Profile from './pages/Profile';
import RequestVerificationPage from './pages/citizen/RequestVerificationPage';
import SellTitlePage from './pages/citizen/SellTitlePage';
import CreateActor from './pages/admin/CreateActor';
import IssueLandTitle from './pages/admin/IssueLandTitle';
import NotificationsPage from './pages/NotificationsPage';
import DashboardShell from './components/layout/DashboardShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';

import AdminHome from './pages/dashboards/AdminHome';
import IssuerHome from './pages/dashboards/IssuerHome';
import VerifierHome from './pages/dashboards/VerifierHome';
import BankHome from './pages/dashboards/BankHome';
import NotaryHome from './pages/dashboards/NotaryHome';
import CitizenHome from './pages/dashboards/CitizenHome';

import IssueDocumentPage from './pages/forms/IssueDocumentPage';
import VerifyDocumentPage from './pages/forms/VerifyDocumentPage';
import PendingRequestsPage from './pages/lists/PendingRequestsPage';
import StateTransfersPage from './pages/lists/StateTransfersPage';

import GenericListPage from './pages/generic/GenericListPage';
import GenericDetailPage from './pages/generic/GenericDetailPage';
import GenericLogPage from './pages/generic/GenericLogPage';
import GenericSettingsPage from './pages/generic/GenericSettingsPage';
import RolesInfoPage from './pages/generic/RolesInfoPage';
import CreateManagedUserPage from './pages/generic/CreateManagedUserPage';
import KycReviewPage from './pages/generic/KycReviewPage';
import SharesPage from './pages/generic/SharesPage';
import {
  fetchAllUsers, fetchCitizens,
  fetchDiplomas, fetchAttestations, fetchAdminAttestations, fetchAdminLandTransfers, fetchAllWorkflows,
  fetchNotarizedActs,
  fetchMyLandTitles, fetchMyDiplomas, fetchMyAttestations, fetchMyIdCards, fetchMyAllDocuments,
  fetchMyRequests, fetchMyOffers, fetchMyEmployees, fetchMyStudents,
} from './pages/generic/fetchers';
import { getRoleTheme } from './theme/roleThemes';
import { getDocTypeLabel, getDocTypeMeta } from './theme/docTypeLabels';

const theme = createTheme({
  typography: { fontFamily: "'DM Sans', Helvetica, Arial, sans-serif" },
  palette: {
    primary: { main: '#4f46e5' },
    secondary: { main: '#f5a623' },
    background: { default: '#eceef4' },
  },
  shape: { borderRadius: 10 },
});

const DIPLOMA_FIELDS = [
  { key: 'fieldOfStudy', label: 'Filière', valueType: 'string' },
  { key: 'graduationDate', label: 'Date de diplôme (AAAA-MM-JJ)', valueType: 'string' },
  { key: 'grade', label: 'Mention', valueType: 'string' },
];
const EMPLOYMENT_FIELDS = [
  { key: 'position', label: 'Poste', valueType: 'string' },
  { key: 'startDate', label: "Date d'entrée (AAAA-MM-JJ)", valueType: 'string' },
  { key: 'salary', label: 'Salaire mensuel (FCFA)', valueType: 'uint256' },
];
const LAND_TITLE_FIELDS = [
  { key: 'landArea', label: 'Superficie (m²)', valueType: 'uint256' },
  { key: 'location', label: 'Localisation', valueType: 'string' },
  { key: 'value', label: 'Valeur estimée (FCFA)', valueType: 'uint256' },
];

const USER_COLUMNS = [
  { key: 'full_name', label: 'Nom' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Rôle' },
  { key: 'did', label: 'DID' },
];
const DOC_COLUMNS = [
  { key: 'doc_key', label: 'Référence' },
  { key: 'owner', label: 'Propriétaire' },
  { key: 'issuer', label: 'Émetteur' },
  { key: 'created_at', label: 'Émis le', render: (r) => new Date(r.created_at).toLocaleDateString('fr-FR') },
];
const WORKFLOW_COLUMNS = [
  { key: 'type', label: 'Type' },
  { key: 'status', label: 'Statut' },
  { key: 'initiator', label: 'Initiateur' },
  { key: 'target', label: 'Cible' },
  { key: 'created_at', label: 'Créé le', render: (r) => new Date(r.created_at).toLocaleDateString('fr-FR') },
];
const MY_DOC_COLUMNS = [
  { key: 'doc_type', label: 'Type', render: (r) => getDocTypeLabel(r.doc_type) },
  ...DOC_COLUMNS,
];
const MY_REQUEST_COLUMNS = [
  { key: 'type', label: 'Type' },
  { key: 'target', label: 'Destinataire' },
  { key: 'status', label: 'Statut' },
  { key: 'created_at', label: 'Envoyée le', render: (r) => new Date(r.created_at).toLocaleDateString('fr-FR') },
];
const MY_OFFER_COLUMNS = [
  { key: 'document_token_id', label: 'Titre', render: (r) => `Token #${r.document_token_id}` },
  { key: 'target', label: 'Acheteur' },
  { key: 'status', label: 'Statut' },
  { key: 'created_at', label: 'Envoyée le', render: (r) => new Date(r.created_at).toLocaleDateString('fr-FR') },
];

const HOME_ROUTE_BY_ROLE = {
  ADMIN: '/admin', ISSUER: '/university', VERIFIER: '/company', BANK: '/bank', NOTARY: '/state', USER: '/dashboard',
};

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  );
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? HOME_ROUTE_BY_ROLE[user.role] || '/dashboard' : '/login'} replace />;
}

function RoleAccentLogPage({ role }) {
  return <GenericLogPage accent={getRoleTheme(role).accent} />;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<AuthenticatedLayout />}>
        <Route path="/" element={<HomeRedirect />} />

        {/* ADMIN */}
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/create-actor" element={<CreateActor />} />
        <Route path="/admin/land-titles" element={<IssueLandTitle />} />
        <Route path="/admin/dids" element={
          <GenericListPage title="DID & Identités" crumb="Gestion des identités" fetcher={fetchAllUsers}
            columns={USER_COLUMNS} searchKeys={['full_name', 'email', 'did']} statusKey="role"
            actionLabel="Créer un acteur" actionPath="/admin/create-actor" />
        } />
        <Route path="/admin/roles" element={<RolesInfoPage />} />
        <Route path="/admin/diplomas" element={
          <GenericListPageWithDetail title="Diplômes" crumb="Titres & documents" fetcher={fetchDiplomas} />
        } />
        <Route path="/admin/attestations" element={
          <GenericListPageWithDetail title="Attestations" crumb="Titres & documents" fetcher={fetchAdminAttestations} />
        } />
        <Route path="/admin/transfers" element={
          <GenericListPage title="Transferts" crumb="Titres & documents" fetcher={fetchAdminLandTransfers}
            columns={WORKFLOW_COLUMNS} searchKeys={['initiator', 'target']} statusKey="status" />
        } />
        <Route path="/admin/workflows" element={
          <GenericListPage title="Demandes & Workflows" crumb="Système" fetcher={fetchAllWorkflows}
            columns={WORKFLOW_COLUMNS} searchKeys={['initiator', 'target']} statusKey="status" />
        } />
        <Route path="/admin/settings" element={<GenericSettingsPage />} />
        <Route path="/admin/journal" element={<RoleAccentLogPage role="ADMIN" />} />

        {/* ISSUER — Université */}
        <Route path="/university" element={<IssuerHome />} />
        <Route path="/university/issue" element={<IssueDocumentPage title="Nouveau diplôme" crumb="Identité académique" docType="DIPLOMA" attributeFields={DIPLOMA_FIELDS} recipientRole="USER" mineOnly />} />
        <Route path="/university/students" element={
          <GenericListPage title="Étudiants" crumb="Identité académique" fetcher={fetchMyStudents}
            columns={USER_COLUMNS} searchKeys={['full_name', 'email']}
            actionLabel="Établir DID" actionPath="/university/create-did" />
        } />
        <Route path="/university/diplomas" element={
          <GenericListPageWithDetail title="Diplômes & Certificats" crumb="Identité académique" fetcher={fetchDiplomas}
            actionLabel="Émettre un diplôme" actionPath="/university/issue" />
        } />
        <Route path="/university/attestations" element={
          <GenericListPageWithDetail title="Attestations" crumb="Identité académique" fetcher={fetchDiplomas} />
        } />
        <Route path="/university/create-did" element={<CreateManagedUserPage />} />
        <Route path="/university/users" element={
          <GenericListPage title="Utilisateurs" crumb="Administration" fetcher={fetchMyStudents}
            columns={USER_COLUMNS} searchKeys={['full_name', 'email']}
            actionLabel="Établir DID" actionPath="/university/create-did" />
        } />
        <Route path="/university/verify" element={<VerifyDocumentPage title="Vérifier un document" crumb="Administration" />} />
        <Route path="/university/requests" element={<PendingRequestsPage title="Demandes de vérification" crumb="Administration" />} />
        <Route path="/university/settings" element={<GenericSettingsPage />} />
        <Route path="/university/journal" element={<RoleAccentLogPage role="ISSUER" />} />

        {/* VERIFIER — Entreprise */}
        <Route path="/company" element={<VerifierHome />} />
        <Route path="/company/create-did" element={<CreateManagedUserPage />} />
        <Route path="/company/issue" element={<IssueDocumentPage title="Nouvelle attestation d'emploi" crumb="Identité" docType="EMPLOYMENT" attributeFields={EMPLOYMENT_FIELDS} recipientRole="USER" mineOnly />} />
        <Route path="/company/verify" element={<VerifyDocumentPage title="Vérifier un document" crumb="Identité" />} />
        <Route path="/company/requests" element={<PendingRequestsPage title="Demandes de vérification en attente" crumb="Administration" />} />
        <Route path="/company/attestations" element={
          <GenericListPageWithDetail title="Attestations d'emploi" crumb="Identité" fetcher={fetchAttestations}
            actionLabel="Émettre une attestation" actionPath="/company/issue" />
        } />
        <Route path="/company/employees" element={
          <GenericListPage title="Employés" crumb="Administration" fetcher={fetchMyEmployees}
            columns={USER_COLUMNS} searchKeys={['full_name', 'email']}
            actionLabel="Établir DID" actionPath="/company/create-did" />
        } />
        <Route path="/company/roles" element={<RolesInfoPage />} />
        <Route path="/company/settings" element={<GenericSettingsPage />} />
        <Route path="/company/journal" element={<RoleAccentLogPage role="VERIFIER" />} />

        {/* BANK — Banque */}
        <Route path="/bank" element={<BankHome />} />
        <Route path="/bank/create-did" element={<CreateManagedUserPage />} />
        <Route path="/bank/verify" element={<VerifyDocumentPage title="Vérifier un document" crumb="Administration" />} />
        <Route path="/bank/loans" element={<PendingRequestsPage title="Demandes de prêt en attente" crumb="Clients" />} />
        <Route path="/bank/clients" element={
          <GenericListPage title="Clients" crumb="Clients" fetcher={fetchCitizens}
            columns={USER_COLUMNS} searchKeys={['full_name', 'email']}
            actionLabel="Établir DID" actionPath="/bank/create-did" />
        } />
        <Route path="/bank/kyc" element={<KycReviewPage title="Demandes KYC récentes" />} />
        <Route path="/bank/journal" element={<RoleAccentLogPage role="BANK" />} />
        <Route path="/bank/settings" element={<GenericSettingsPage />} />

        {/* NOTARY — État */}
        <Route path="/state" element={<NotaryHome />} />
        <Route path="/state/register" element={<IssueDocumentPage title="Enregistrer un titre foncier" crumb="Actes notariés" docType="LAND_TITLE" attributeFields={LAND_TITLE_FIELDS} recipientRole="USER" />} />
        <Route path="/state/transfers" element={<StateTransfersPage />} />
        <Route path="/state/signatures" element={
          <StateTransfersPage title="Signatures en attente" crumb="Actes notariés" onlyAwaitingNotary />
        } />
        <Route path="/state/acts" element={
          <GenericListPage title="Liste des actes" crumb="Actes notariés" fetcher={fetchNotarizedActs}
            columns={[
              { key: 'document_token_id', label: 'Titre', render: (r) => `Token #${r.document_token_id}` },
              { key: 'status', label: 'Statut' },
              { key: 'completed_at', label: 'Finalisé le', render: (r) => r.completed_at ? new Date(r.completed_at).toLocaleDateString('fr-FR') : '—' },
            ]}
            searchKeys={['document_token_id']}
          />
        } />
        <Route path="/state/verifications" element={<KycReviewPage title="Vérifications" />} />
        <Route path="/state/verify" element={<VerifyDocumentPage title="Vérifier un document" crumb="Contrôles" />} />
        <Route path="/state/journal" element={<RoleAccentLogPage role="NOTARY" />} />
        <Route path="/state/settings" element={<GenericSettingsPage />} />

        {/* USER — Citoyen */}
        <Route path="/dashboard" element={<CitizenHome />} />
        <Route path="/dashboard/documents/all" element={
          <GenericListPageWithDetail title="Tous mes documents" crumb="Mon espace" fetcher={fetchMyAllDocuments}
            columns={MY_DOC_COLUMNS} searchKeys={['doc_key', 'issuer']} rowIcon={(r) => getDocTypeMeta(r.doc_type)} />
        } />
        <Route path="/dashboard/documents" element={<RequestVerificationPage />} />
        <Route path="/dashboard/land-titles" element={
          <GenericListPageWithDetail title="Titres fonciers" crumb="Mon espace" fetcher={fetchMyLandTitles}
            rowIcon={() => getDocTypeMeta('LAND_TITLE')} />
        } />
        <Route path="/dashboard/sell-title" element={<SellTitlePage />} />
        <Route path="/dashboard/diplomas" element={
          <GenericListPageWithDetail title="Diplômes" crumb="Mon espace" fetcher={fetchMyDiplomas}
            rowIcon={() => getDocTypeMeta('DIPLOMA')} />
        } />
        <Route path="/dashboard/attestations" element={
          <GenericListPageWithDetail title="Attestations" crumb="Mon espace" fetcher={fetchMyAttestations}
            rowIcon={() => getDocTypeMeta('EMPLOYMENT')} />
        } />
        <Route path="/dashboard/id-cards" element={
          <GenericListPageWithDetail title="Pièces d'identité" crumb="Mon espace" fetcher={fetchMyIdCards}
            rowIcon={() => getDocTypeMeta('ID_CARD')} />
        } />
        <Route path="/dashboard/requests" element={
          <GenericListPage title="Mes demandes" crumb="Mon espace" fetcher={fetchMyRequests}
            columns={MY_REQUEST_COLUMNS} searchKeys={['type', 'target']} statusKey="status" />
        } />
        <Route path="/dashboard/offers" element={<MyOffersPage />} />
        <Route path="/dashboard/shares" element={<SharesPage />} />
        <Route path="/dashboard/verify" element={<VerifyDocumentPage title="Vérifier un document externe" crumb="Mon espace" />} />
        <Route path="/dashboard/journal" element={<RoleAccentLogPage role="USER" />} />
        <Route path="/dashboard/settings" element={<GenericSettingsPage />} />

        {/* Partagées entre rôles */}
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/documents/:tokenId/history" element={<DocumentHistory />} />
        <Route path="/documents/:tokenId/detail" element={<GenericDetailPage />} />
        <Route path="/transfer/:workflowId" element={<TransferSign />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

/** Fine couche au-dessus de GenericListPage : ajoute la navigation vers la fiche détail
 * d'un document au clic sur une ligne (colonnes standard réutilisées pour toutes les
 * listes de documents). */
function MyOffersPage() {
  const navigate = useNavigate();
  return (
    <GenericListPage title="Offres reçues" crumb="Mon espace" fetcher={fetchMyOffers}
      columns={MY_OFFER_COLUMNS} searchKeys={['target']}
      onRowClick={(row) => navigate(`/transfer/${row.id}`)} />
  );
}

function GenericListPageWithDetail({ fetcher, ...rest }) {
  const navigate = useNavigate();
  return (
    <GenericListPage
      fetcher={fetcher}
      columns={DOC_COLUMNS}
      searchKeys={['doc_key', 'owner', 'issuer']}
      onRowClick={(row) => navigate(`/documents/${row.token_id}/detail`)}
      {...rest}
    />
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationsProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
