import React, { useCallback, useEffect, useState } from 'react';
import { Box, Grid, Typography, CircularProgress, Alert } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import BadgeIcon from '@mui/icons-material/Badge';
import GroupsIcon from '@mui/icons-material/Groups';
import { getStatsOverview, getIssuedDocuments, getRecentActivity } from '../../services/api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { getRoleTheme } from '../../theme/roleThemes';
import StatCard from '../../components/dashboard/StatCard';
import SectionCard from '../../components/dashboard/SectionCard';
import ActivityList from '../../components/dashboard/ActivityList';
import QuickActionCard from '../../components/dashboard/QuickActionCard';
import PendingVerificationsPanel from '../../components/PendingVerificationsPanel';

export default function VerifierHome() {
  const theme = getRoleTheme('VERIFIER');
  const [stats, setStats] = useState(null);
  const [recentAttestations, setRecentAttestations] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsData, docs, activityData] = await Promise.all([
        getStatsOverview(), getIssuedDocuments('EMPLOYMENT'), getRecentActivity(4),
      ]);
      setStats(statsData);
      setRecentAttestations(docs.slice(0, 4));
      setActivity(activityData);
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
      <Typography sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em' }}>Tableau de bord Entreprise</Typography>
      <Typography sx={{ fontSize: 13, color: '#8a90a2', mt: 0.5, mb: 2.5 }}>
        Vérifiez les documents et gérez les attestations
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<VerifiedIcon />} label="Vérifications ce mois" value={stats.verifications_month} accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<HourglassEmptyIcon />} label="Demandes en attente" value={stats.pending_requests} accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<BadgeIcon />} label="Attestations émises" value={stats.attestations_issued}
            deltaLabel={`+${stats.attestations_delta_month} ce mois`} accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<GroupsIcon />} label="Employés enregistrés" value={stats.employees_registered} accent={theme.accent} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <PendingVerificationsPanel title="Demandes de vérification en attente" />
        </Grid>
        <Grid item xs={12} md={6}>
          <SectionCard title="Attestations d'emploi récentes" viewAllPath="/company/attestations">
            <ActivityList
              items={recentAttestations.map((d) => ({
                title: d.owner, subtitle: d.doc_key, timestamp: d.created_at,
              }))}
              emptyLabel="Aucune attestation émise pour le moment."
            />
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard icon={<VerifiedIcon />} title="Vérifier un document" subtitle="Vérification par CID / Hash"
            path="/company/verify" accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard icon={<BadgeIcon />} title="Émettre une attestation" subtitle="Créer une attestation d'emploi"
            path="/company/attestations/new" accent={theme.accent} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <SectionCard title="Activité récente" viewAllPath="/company/journal">
            <ActivityList items={activity.map((e) => ({ title: e.message, timestamp: e.timestamp }))} />
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
