import React, { useCallback, useEffect, useState } from 'react';
import { Box, Grid, Typography, CircularProgress, Alert } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import DescriptionIcon from '@mui/icons-material/Description';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import { getStatsOverview, getRecentActivity } from '../../services/api';
import { useLiveRefresh } from '../../hooks/useLiveRefresh';
import { getRoleTheme } from '../../theme/roleThemes';
import { getDocTypeLabel } from '../../theme/docTypeLabels';
import StatCard from '../../components/dashboard/StatCard';
import SectionCard from '../../components/dashboard/SectionCard';
import ActivityList from '../../components/dashboard/ActivityList';
import DonutChart from '../../components/dashboard/DonutChart';

const RANGE_DAYS = { '7 jours': 7, '30 jours': 30, '90 jours': 90 };
const BAR_COLORS = ['#4f46e5', '#2563eb', '#10b981', '#f97316', '#7c3aed'];

function ActivityChart({ dailyActivity }) {
  const [range, setRange] = useState('30 jours');
  const days = RANGE_DAYS[range];
  const series = dailyActivity.slice(-days);
  const max = Math.max(1, ...series.map((d) => d.count));
  const width = Math.max(560, series.length * 8);
  const height = 130;
  const points = series.map((d, i) => {
    const x = series.length > 1 ? (i / (series.length - 1)) * width : 0;
    const y = height - (d.count / max) * (height - 10) - 5;
    return { x, y, ...d };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1]?.x || 0} ${height} L 0 ${height} Z`;
  const labelIdx = [0, Math.floor(points.length / 4), Math.floor(points.length / 2), Math.floor((3 * points.length) / 4), points.length - 1];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.25 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Statistiques de la plateforme</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {Object.keys(RANGE_DAYS).map((label) => (
            <Box
              key={label}
              onClick={() => setRange(label)}
              sx={{
                px: 1.25, py: 0.5, borderRadius: '8px', fontSize: 11.5, cursor: 'pointer',
                border: `1px solid ${range === label ? '#c7c2ea' : '#e7e9f2'}`,
                bgcolor: range === label ? '#f5f3ff' : '#fff',
                color: range === label ? '#4f46e5' : '#5b6070',
                fontWeight: range === label ? 500 : 400,
              }}
            >
              {label}
            </Box>
          ))}
        </Box>
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
          <g stroke="#f0f1f7" strokeWidth="1">
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1="0" y1={height * f} x2={width} y2={height * f} />
            ))}
          </g>
          <path d={areaPath} fill="rgba(99,91,231,0.12)" />
          <path d={linePath} fill="none" stroke="#635be7" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
          {points.length > 0 && <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="3.5" fill="#635be7" />}
        </svg>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5, width }}>
          {labelIdx.map((idx) => (
            <Typography key={idx} sx={{ fontSize: 10.5, color: '#a3a8b8' }}>
              {points[idx] ? new Date(points[idx].date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
            </Typography>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default function AdminHome() {
  const theme = getRoleTheme('ADMIN');
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [statsData, activityData] = await Promise.all([
        getStatsOverview(), getRecentActivity(4),
      ]);
      setStats(statsData);
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

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!stats) return null;

  const maxDocType = Math.max(1, ...stats.documents_by_type.map((d) => d.count));
  const totalDocs = stats.documents_by_type.reduce((s, d) => s + d.count, 0);

  return (
    <Box>
      <Typography sx={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.015em' }}>Bonjour, Admin</Typography>
      <Typography sx={{ fontSize: 13, color: '#8a90a2', mt: 0.5, mb: 1.75 }}>
        Voici un aperçu de l'activité de la plateforme.
      </Typography>

      <Grid container spacing={1.75} sx={{ mb: 1.75 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<GroupsIcon />} label="Acteurs" value={stats.actors_total}
            deltaLabel={`+${stats.actors_delta_month} ce mois`} accent={theme.accent} iconSize={40} iconRadius="999px" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<DescriptionIcon />} label="Documents émis" value={stats.documents_total}
            deltaLabel={`+${stats.documents_delta_month} ce mois`} accent={theme.accent} iconSize={40} iconRadius="999px" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<HomeWorkIcon />} label="Titres fonciers" value={stats.land_titles_total}
            deltaLabel={`+${stats.land_titles_delta_month} ce mois`} accent={theme.accent} iconSize={40} iconRadius="999px" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard icon={<SwapHorizIcon />} label="Transactions" value={stats.transactions_total}
            deltaLabel={`+${stats.transactions_delta_month} ce mois`} accent={theme.accent} iconSize={40} iconRadius="999px" />
        </Grid>
      </Grid>

      <Grid container spacing={1.75} sx={{ mb: 1.75 }} alignItems="stretch">
        <Grid item xs={12} md={7} sx={{ display: 'flex' }}>
          <SectionCard title="Activité récente" viewAllPath="/admin/journal">
            <ActivityList items={activity.map((e) => ({ title: e.message, timestamp: e.timestamp }))} />
          </SectionCard>
        </Grid>
        <Grid item xs={12} md={5} sx={{ display: 'flex' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, width: '100%' }}>
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <SectionCard title="Répartition des rôles">
                <DonutChart data={stats.roles_breakdown.map((r) => ({ label: r.role, count: r.count }))} />
              </SectionCard>
            </Box>

            <Box sx={{
              position: 'relative', overflow: 'hidden', borderRadius: '14px', p: 1.25, flexShrink: 0,
              background: 'linear-gradient(115deg,#4f46e5 0%,#7c3aed 100%)', color: '#fff',
            }}>
              <VerifiedUserIcon sx={{ position: 'absolute', right: -10, top: 4, fontSize: 60, color: 'rgba(255,255,255,0.14)' }} />
              <Typography sx={{ position: 'relative', fontSize: 11.5, fontWeight: 500 }}>Vérifications aujourd'hui</Typography>
              <Typography sx={{ position: 'relative', fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', mt: 0.25 }}>
                {stats.verifications_today}
              </Typography>
              {stats.verifications_delta_pct != null && (
                <Typography sx={{ position: 'relative', fontSize: 10, mt: 0.25, color: '#e4e0ff' }}>
                  {stats.verifications_delta_pct >= 0 ? '↑' : '↓'}{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: '#fff' }}>{Math.abs(stats.verifications_delta_pct)}%</Box>
                  {' '}par rapport à hier
                </Typography>
              )}
            </Box>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={1.75} alignItems="stretch">
        <Grid item xs={12} md={7} sx={{ display: 'flex' }}>
          <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 1.75, width: '100%', boxSizing: 'border-box' }}>
            <ActivityChart dailyActivity={stats.daily_activity} />
          </Box>
        </Grid>
        <Grid item xs={12} md={5} sx={{ display: 'flex' }}>
          <SectionCard title="Documents par type">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {stats.documents_by_type.map((d, i) => (
                <Box key={d.doc_type}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                    <Typography sx={{ fontSize: 12, color: '#3b4054' }}>{getDocTypeLabel(d.doc_type)}</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{d.count.toLocaleString('fr-FR')}</Typography>
                  </Box>
                  <Box sx={{ height: 5, borderRadius: 999, bgcolor: '#f0f1f7', mt: 0.6 }}>
                    <Box sx={{
                      width: `${Math.max(4, (d.count / maxDocType) * 100)}%`, height: 5, borderRadius: 999,
                      bgcolor: BAR_COLORS[i % BAR_COLORS.length],
                    }} />
                  </Box>
                </Box>
              ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mt: 1.25, pt: 1, borderTop: '1px solid #eceef4' }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>Total</Typography>
              <Typography sx={{ fontSize: 15.5, fontWeight: 700 }}>{totalDocs.toLocaleString('fr-FR')}</Typography>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

    </Box>
  );
}
