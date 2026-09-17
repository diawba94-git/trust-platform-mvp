import React, { useCallback, useEffect, useState } from 'react';
import { Box, Grid, Typography, CircularProgress, Alert } from '@mui/material';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import GroupsIcon from '@mui/icons-material/Groups';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CheckIcon from '@mui/icons-material/Check';
import { getStatsOverview, getIssuedDocuments, getRecentActivity } from '../../services/api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { useAuth } from '../../context/AuthContext';
import { getRoleTheme } from '../../theme/roleThemes';
import StatCard from '../../components/dashboard/StatCard';
import SectionCard from '../../components/dashboard/SectionCard';
import ActivityList from '../../components/dashboard/ActivityList';
import TrendLine from '../../components/dashboard/TrendLine';
import QuickActionCard from '../../components/dashboard/QuickActionCard';
import PendingVerificationsPanel from '../../components/PendingVerificationsPanel';

export default function IssuerHome() {
  const { user } = useAuth();
  const theme = getRoleTheme('ISSUER');
  const [stats, setStats] = useState(null);
  const [recentDiplomas, setRecentDiplomas] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsData, docs, activityData] = await Promise.all([
        getStatsOverview(), getIssuedDocuments('DIPLOMA'), getRecentActivity(4),
      ]);
      setStats(statsData);
      setRecentDiplomas(docs.slice(0, 4));
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 0.75 }}>
        <Typography sx={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.015em' }}>
          Bienvenue, {user?.full_name}
        </Typography>
        <Box sx={{
          width: 21, height: 21, borderRadius: '999px', bgcolor: theme.accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <CheckIcon sx={{ fontSize: 13 }} />
        </Box>
      </Box>
      <Typography sx={{ fontSize: 13.5, color: '#8a90a2', mb: 2.5 }}>
        Gérez l'identité académique et les diplômes sur la blockchain.
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<WorkspacePremiumIcon />} label="Diplômes émis" value={stats.diplomas_issued}
            deltaLabel={`+${stats.diplomas_delta_month} ce mois`} accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<HourglassEmptyIcon />} label="Demandes en attente" value={stats.pending_requests}
            accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<GroupsIcon />} label="Étudiants inscrits" value={stats.students_enrolled}
            accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<FactCheckIcon />} label="Vérifications" value={stats.verifications_count}
            accent={theme.accent} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <SectionCard title="Diplômes récemment émis" viewAllPath="/university/diplomas">
            <ActivityList
              items={recentDiplomas.map((d) => ({
                title: d.owner, subtitle: d.doc_key, timestamp: d.created_at,
                statusLabel: 'Émis', statusColor: 'success',
              }))}
              emptyLabel="Aucun diplôme émis pour le moment."
            />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={5}>
          <PendingVerificationsPanel title="Demandes de vérification" />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <SectionCard title="Émissions par mois">
            <TrendLine data={stats.monthly_issuance} color={theme.accent} />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={5}>
          <SectionCard title="Activité récente" viewAllPath="/university/journal">
            <ActivityList items={activity.map((e) => ({ title: e.message, timestamp: e.timestamp }))} />
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={4}>
          <QuickActionCard
            icon={<AddCircleIcon />}
            title="Émettre un nouveau diplôme"
            path="/university/issue"
            accent={theme.accent}
          />
        </Grid>
      </Grid>
    </Box>
  );
}
