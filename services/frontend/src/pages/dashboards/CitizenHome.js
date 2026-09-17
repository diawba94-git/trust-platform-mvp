import React, { useCallback, useEffect, useState } from 'react';
import { Box, Grid, Typography, CircularProgress, Alert } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import VerifiedIcon from '@mui/icons-material/Verified';
import SellIcon from '@mui/icons-material/Sell';
import HistoryIcon from '@mui/icons-material/History';
import { getStatsOverview, getMyDocuments, getMyWorkflows } from '../../services/api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { getRoleTheme } from '../../theme/roleThemes';
import { getDocTypeLabel } from '../../theme/docTypeLabels';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/dashboard/StatCard';
import SectionCard from '../../components/dashboard/SectionCard';
import ActivityList from '../../components/dashboard/ActivityList';
import QuickActionCard from '../../components/dashboard/QuickActionCard';
import PendingVerificationsPanel from '../../components/PendingVerificationsPanel';

const WORKFLOW_TYPE_LABELS = {
  DIPLOMA_VERIFICATION: 'Demande de vérification',
  LOAN_APPLICATION: 'Demande de prêt',
  LAND_TRANSFER: 'Vente de titre foncier',
  EMPLOYMENT_VERIFICATION: "Vérification d'emploi",
  ID_CARD_ISSUANCE: "Émission de carte d'identité",
};
const STATUS_LABELS = {
  PENDING: 'En attente', IN_PROGRESS: 'En cours', AWAITING_VERIFICATION: 'En attente',
  AWAITING_NOTARY: 'En attente', COMPLETED: 'Approuvée', REJECTED: 'Rejetée', CANCELLED: 'Annulée',
};
const STATUS_COLORS = {
  PENDING: 'default', IN_PROGRESS: 'info', AWAITING_VERIFICATION: 'warning',
  AWAITING_NOTARY: 'warning', COMPLETED: 'success', REJECTED: 'error', CANCELLED: 'default',
};

export default function CitizenHome() {
  const { user } = useAuth();
  const theme = getRoleTheme('USER');
  const [stats, setStats] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsData, docs, flows] = await Promise.all([
        getStatsOverview(), getMyDocuments(), getMyWorkflows(),
      ]);
      setStats(statsData);
      setDocuments(docs);
      setWorkflows(flows);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!stats) return null;

  const offers = workflows.filter((w) => w.type === 'LAND_TRANSFER' && w.status === 'AWAITING_VERIFICATION');
  const requests = workflows.filter((w) => w.type !== 'LAND_TRANSFER');

  return (
    <Box>
      <Box sx={{
        display: 'inline-block', p: '4px 10px', borderRadius: '6px', bgcolor: '#eef2ff', color: theme.accent,
        fontWeight: 700, fontSize: 9.5, letterSpacing: '0.1em', mb: 1.25,
      }}>
        UTILISATEUR
      </Box>
      <Typography sx={{ fontSize: 25, fontWeight: 700, letterSpacing: '-0.015em' }}>
        Bienvenue, {user?.full_name}
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#8a90a2', mt: 0.75, mb: 2.5 }}>
        Gérez votre identité numérique et vos attestations en toute confiance.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<FolderIcon />} label="Mes documents" value={stats.my_documents_total}
            deltaLabel="Tous types" neutral accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<AssignmentIcon />} label="Demandes en cours" value={stats.requests_pending}
            deltaLabel="En attente" neutral accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<LocalOfferIcon />} label="Offres reçues" value={stats.offers_received}
            deltaLabel="Titre foncier" neutral accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<VerifiedIcon />} label="Documents vérifiés" value={stats.documents_verified_total}
            deltaLabel="Total" neutral accent={theme.accent} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <PendingVerificationsPanel title="Demandes à vérifier" />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={5}>
          <SectionCard title="Mes documents" viewAllPath="/dashboard/documents/all">
            <ActivityList
              items={documents.slice(0, 4).map((d) => ({
                title: getDocTypeLabel(d.doc_type), subtitle: d.issuer, timestamp: d.created_at,
                statusLabel: d.is_active ? 'Vérifié' : 'Inactif', statusColor: d.is_active ? 'success' : 'default',
              }))}
              emptyLabel="Aucun document pour le moment."
            />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <SectionCard title="Mes demandes" viewAllPath="/dashboard/requests">
            <ActivityList
              items={requests.slice(0, 4).map((w) => ({
                title: WORKFLOW_TYPE_LABELS[w.type] || w.type, timestamp: w.created_at,
                statusLabel: STATUS_LABELS[w.status] || w.status, statusColor: STATUS_COLORS[w.status] || 'default',
              }))}
              emptyLabel="Aucune demande en cours."
            />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={3}>
          <SectionCard title="Offres reçues" viewAllPath="/dashboard/offers">
            <ActivityList
              items={offers.slice(0, 4).map((w) => ({
                title: `Titre #${w.document_token_id}`, timestamp: w.created_at,
                statusLabel: 'Offre reçue', statusColor: 'warning',
              }))}
              emptyLabel="Aucune offre reçue."
            />
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard icon={<VerifiedIcon />} title="Demander une vérification" subtitle="Envoyer un document"
            path="/dashboard/documents" accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard icon={<SellIcon />} title="Mettre en vente un titre" subtitle="Créer une offre de vente"
            path="/dashboard/sell-title" accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard icon={<HistoryIcon />} title="Voir l'historique" subtitle="Historique de mes documents"
            path="/dashboard/journal" accent={theme.accent} />
        </Grid>
      </Grid>
    </Box>
  );
}
