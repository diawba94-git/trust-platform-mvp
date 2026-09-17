import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { getRecentActivity } from '../../services/api';
import { timeAgo } from '../../utils/timeAgo';

/** Journal d'activités — un seul appel réutilisé pour les 6 rôles, /stats/activity renvoie
 * déjà un flux scopé au rôle appelant (cf. routers/stats.py). */
export default function GenericLogPage({ title = "Journal d'activités", accent }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getRecentActivity(30)
      .then(setLogs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em' }}>{title}</Typography>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', mt: 2.5, p: 2.75 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={22} /></Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : logs.length === 0 ? (
          <Typography sx={{ color: '#8a90a2', fontSize: 13 }}>Aucune activité pour le moment.</Typography>
        ) : (
          logs.map((l, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.75, py: 1.75, borderBottom: i < logs.length - 1 ? '1px solid #f4f5fa' : 'none' }}>
              <Box sx={{ width: 9, height: 9, mt: 0.7, flexShrink: 0, borderRadius: '50%', bgcolor: accent || '#4f46e5' }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{l.message}</Typography>
              </Box>
              <Typography sx={{ fontSize: 11, color: '#a3a8b8', whiteSpace: 'nowrap' }}>{timeAgo(l.timestamp)}</Typography>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
