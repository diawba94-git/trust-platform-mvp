import React, { useCallback, useEffect, useState } from 'react';
import { Box, Grid, CircularProgress, Alert } from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GavelIcon from '@mui/icons-material/Gavel';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { getStatsOverview, getIssuedDocuments, getMyWorkflows, getUsers } from '../../services/api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { getRoleTheme } from '../../theme/roleThemes';
import StatCard from '../../components/dashboard/StatCard';
import SectionCard from '../../components/dashboard/SectionCard';
import ActivityList from '../../components/dashboard/ActivityList';
import DonutChart from '../../components/dashboard/DonutChart';
import QuickActionCard from '../../components/dashboard/QuickActionCard';

const KYC_STATUS_LABELS = { PENDING: 'En attente', APPROVED: 'Vérifiées', REJECTED: 'Échouées' };

export default function NotaryHome() {
  const theme = getRoleTheme('NOTARY');
  const [stats, setStats] = useState(null);
  const [recentTitles, setRecentTitles] = useState([]);
  const [pendingTransfers, setPendingTransfers] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsData, titles, workflows, users] = await Promise.all([
        getStatsOverview(), getIssuedDocuments('LAND_TITLE'), getMyWorkflows(), getUsers(),
      ]);
      setStats(statsData);
      setRecentTitles(titles.slice(0, 4));
      setPendingTransfers(
        workflows.filter((w) => w.type === 'LAND_TRANSFER' && w.status !== 'COMPLETED' && w.status !== 'REJECTED')
      );
      setUsersById(Object.fromEntries(users.map((u) => [u.id, u.full_name])));
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

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<HomeWorkIcon />} label="Titres fonciers gérés" value={stats.titles_registered}
            deltaLabel={`+${stats.titles_delta_month} ce mois`} accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<SyncAltIcon />} label="Transferts en cours" value={stats.transfers_in_progress} accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<GavelIcon />} label="Actes notariés" value={stats.notarized_acts} deltaLabel="Ce mois-ci" neutral accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<CheckCircleIcon />} label="Parties vérifiées" value={stats.parties_verified_month} deltaLabel="Ce mois-ci" neutral accent={theme.accent} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <SectionCard title="Transferts en attente de signature" viewAllPath="/state/signatures">
            <ActivityList
              items={pendingTransfers.map((w) => ({
                title: `TF — Token #${w.document_token_id}`,
                subtitle: `Vendeur : ${usersById[w.initiator_id] || '?'} · Acheteur : ${usersById[w.target_user_id] || '?'}`,
                timestamp: w.created_at,
                statusLabel: 'En attente', statusColor: 'warning',
              }))}
              emptyLabel="Aucun transfert en attente."
            />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title="Répartition des titres fonciers (localisation)">
            <DonutChart data={stats.titles_by_location.map((l) => ({ label: l.location, count: l.count }))} />
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <SectionCard title="Enregistrement récent de titres" viewAllPath="/state/acts">
            <ActivityList
              items={recentTitles.map((d) => ({
                title: d.doc_key, subtitle: `Propriétaire : ${d.owner}`, timestamp: d.created_at,
              }))}
              emptyLabel="Aucun titre enregistré pour le moment."
            />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title="Vérifications des parties" viewAllPath="/state/verifications">
            <DonutChart size={130} thickness={23} data={stats.parties_by_status.map((s) => ({ label: KYC_STATUS_LABELS[s.status] || s.status, count: s.count }))} />
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard icon={<AddCircleIcon />} title="Enregistrer un nouveau titre" subtitle="Saisir un titre foncier"
            path="/state/register" accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard icon={<AssignmentIcon />} title="Voir les transferts en cours" subtitle="Suivre les workflows"
            path="/state/transfers" accent={theme.accent} />
        </Grid>
      </Grid>
    </Box>
  );
}
