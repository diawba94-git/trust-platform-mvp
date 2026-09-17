import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress } from '@mui/material';

import Login from './pages/Login';
import Console from './pages/Console';
import DocumentHistory from './pages/DocumentHistory';
import TransferSign from './pages/TransferSign';
import Profile from './pages/Profile';
import SellTitlePage from './pages/citizen/SellTitlePage';
import MyDocumentsPage from './pages/citizen/MyDocumentsPage';
import CreateActor from './pages/admin/CreateActor';
import IssueLandTitle from './pages/admin/IssueLandTitle';
import NotificationsPage from './pages/NotificationsPage';
import DashboardShell from './components/layout/DashboardShell';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';

import IssueDocumentPage from './pages/forms/IssueDocumentPage';
import VerifyDocumentPage from './pages/forms/VerifyDocumentPage';
import PendingRequestsPage from './pages/lists/PendingRequestsPage';
import StateTransfersPage from './pages/lists/StateTransfersPage';

import CreateManagedUserPage from './pages/generic/CreateManagedUserPage';
import SharesPage from './pages/generic/SharesPage';
import KycReviewPage from './pages/generic/KycReviewPage';
import RequestVerificationPage from './pages/citizen/RequestVerificationPage';

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
  return <Navigate to={user ? '/console' : '/login'} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<AuthenticatedLayout />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/console" element={<Console />} />

        {/* ADMIN */}
        <Route path="/admin/create-actor" element={<CreateActor />} />
        <Route path="/admin/land-titles" element={<IssueLandTitle />} />

        {/* ISSUER — Université */}
        <Route path="/university/issue" element={<IssueDocumentPage title="Nouveau diplôme" crumb="Identité académique" docType="DIPLOMA" attributeFields={DIPLOMA_FIELDS} recipientRole="USER" mineOnly />} />
        <Route path="/university/create-did" element={<CreateManagedUserPage />} />
        <Route path="/university/verify" element={<VerifyDocumentPage title="Vérifier un document" crumb="Administration" />} />
        <Route path="/university/requests" element={<PendingRequestsPage title="Demandes de vérification" crumb="Administration" />} />

        {/* VERIFIER — Entreprise */}
        <Route path="/company/create-did" element={<CreateManagedUserPage />} />
        <Route path="/company/issue" element={<IssueDocumentPage title="Nouvelle attestation d'emploi" crumb="Identité" docType="EMPLOYMENT" attributeFields={EMPLOYMENT_FIELDS} recipientRole="USER" mineOnly />} />
        <Route path="/company/verify" element={<VerifyDocumentPage title="Vérifier un document" crumb="Identité" />} />
        <Route path="/company/requests" element={<PendingRequestsPage title="Demandes de vérification en attente" crumb="Administration" />} />

        {/* BANK — Banque */}
        <Route path="/bank/create-did" element={<CreateManagedUserPage />} />
        <Route path="/bank/verify" element={<VerifyDocumentPage title="Vérifier un document" crumb="Administration" />} />
        <Route path="/bank/loans" element={<PendingRequestsPage title="Demandes de prêt en attente" crumb="Clients" />} />
        <Route path="/bank/kyc" element={<KycReviewPage title="Demandes KYC récentes" />} />

        {/* NOTARY — État */}
        <Route path="/state/register" element={<IssueDocumentPage title="Enregistrer un titre foncier" crumb="Actes notariés" docType="LAND_TITLE" attributeFields={LAND_TITLE_FIELDS} recipientRole="USER" />} />
        <Route path="/state/transfers" element={<StateTransfersPage />} />
        <Route path="/state/signatures" element={
          <StateTransfersPage title="Signatures en attente" crumb="Actes notariés" onlyAwaitingNotary />
        } />
        <Route path="/state/verify" element={<VerifyDocumentPage title="Vérifier un document" crumb="Contrôles" />} />
        <Route path="/state/verifications" element={<KycReviewPage title="Vérifications" />} />

        {/* USER — Citoyen */}
        <Route path="/dashboard/documents/all" element={<MyDocumentsPage />} />
        <Route path="/dashboard/sell-title" element={<SellTitlePage />} />
        <Route path="/dashboard/shares" element={<SharesPage />} />
        <Route path="/dashboard/verify" element={<VerifyDocumentPage title="Vérifier un document externe" crumb="Mon espace" />} />
        <Route path="/dashboard/documents" element={<RequestVerificationPage />} />

        {/* Partagées entre rôles */}
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/documents/:tokenId/history" element={<DocumentHistory />} />
        <Route path="/transfer/:workflowId" element={<TransferSign />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
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
