import React, { useCallback, useEffect, useState } from 'react';
import { Box, Grid, Typography, CircularProgress, Alert } from '@mui/material';
import BadgeIcon from '@mui/icons-material/Badge';
import VerifiedIcon from '@mui/icons-material/Verified';
import GroupsIcon from '@mui/icons-material/Groups';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import { getStatsOverview, getPendingKyc, getRecentActivity } from '../../services/api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { getRoleTheme } from '../../theme/roleThemes';
import StatCard from '../../components/dashboard/StatCard';
import SectionCard from '../../components/dashboard/SectionCard';
import ActivityList from '../../components/dashboard/ActivityList';
import DonutChart from '../../components/dashboard/DonutChart';

const STATUS_LABELS = { PENDING: 'En attente', APPROVED: 'Réussies', REJECTED: 'Échouées' };

export default function BankHome() {
  const theme = getRoleTheme('BANK');
  const [stats, setStats] = useState(null);
  const [recentKyc, setRecentKyc] = useState([]);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsData, kyc, activityData] = await Promise.all([
        getStatsOverview(), getPendingKyc(), getRecentActivity(4),
      ]);
      setStats(statsData);
      setRecentKyc(kyc.slice(0, 4));
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
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<BadgeIcon />} label="Demandes KYC" value={stats.kyc_pending} deltaLabel="En attente" neutral accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<VerifiedIcon />} label="Vérifications" value={stats.kyc_reviewed_month} deltaLabel="Ce mois-ci" neutral accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<GroupsIcon />} label="Clients vérifiés" value={stats.clients_verified_total} deltaLabel="Total" neutral accent={theme.accent} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<RequestQuoteIcon />} label="Demandes de prêt" value={stats.loan_requests_pending} deltaLabel="En attente" neutral accent={theme.accent} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={7}>
          <SectionCard title="Demandes KYC récentes" viewAllPath="/bank/kyc">
            <ActivityList
              items={recentKyc.map((k) => ({
                title: k.full_name, subtitle: `CNI ${k.id_card_number || '—'}`, timestamp: k.created_at,
                statusLabel: 'En attente', statusColor: 'warning',
              }))}
              emptyLabel="Aucune demande en attente."
            />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={5}>
          <SectionCard title="Vérifications par statut">
            <DonutChart data={stats.kyc_by_status.map((s) => ({ label: STATUS_LABELS[s.status] || s.status, count: s.count }))} />
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <SectionCard title="Montant des prêts (ce mois)">
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {stats.loan_amount_month.toLocaleString('fr-FR')} FCFA
            </Typography>
            {stats.loan_amount_delta_pct != null && (
              <Typography variant="caption" sx={{ color: stats.loan_amount_delta_pct >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                {stats.loan_amount_delta_pct >= 0 ? '+' : ''}{stats.loan_amount_delta_pct}% vs mois dernier
              </Typography>
            )}
          </SectionCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <SectionCard title="Activité récente" viewAllPath="/bank/journal">
            <ActivityList items={activity.map((e) => ({ title: e.message, timestamp: e.timestamp }))} />
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}
