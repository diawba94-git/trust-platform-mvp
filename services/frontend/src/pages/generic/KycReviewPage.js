import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Chip } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { getRoleTheme } from '../../theme/roleThemes';
import { getPendingKyc, reviewKyc } from '../../services/api';

/** File de dossiers KYC à revoir (Banque : "Demandes KYC" / Notaire : "Vérifications") —
 * données réelles persistées via POST /verification/kyc/submit (wallet mobile), cf.
 * routers/kyc.py. */
export default function KycReviewPage({ title = 'Demandes KYC' }) {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    getPendingKyc().then(setRecords).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleReview(id, approve) {
    setBusyId(id);
    try {
      await reviewKyc(id, approve, approve ? 'Dossier conforme' : 'Dossier incomplet');
      setRecords((rs) => rs.filter((r) => r.id !== id));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Box>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em' }}>{title}</Typography>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', mt: 2.5, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : records.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: 'center', color: '#8a90a2', fontSize: 13 }}>Aucune demande en attente.</Typography>
        ) : (
          records.map((r, i) => (
            <Box key={r.id} sx={{
              display: 'flex', alignItems: 'center', gap: 2, px: 2.25, py: 1.75,
              borderBottom: i < records.length - 1 ? '1px solid #f4f5fa' : 'none',
            }}>
              <Box sx={{
                width: 34, height: 34, borderRadius: '50%', bgcolor: `${theme.accent}1a`, color: theme.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {r.full_name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>{r.full_name}</Typography>
                <Typography sx={{ fontSize: 10.5, color: '#a3a8b8', mt: 0.3 }}>
                  CNI {r.id_card_number || '—'} · {new Date(r.created_at).toLocaleDateString('fr-FR')}
                </Typography>
              </Box>
              <Chip size="small" label={r.phone_verified ? 'Tél ✓' : 'Tél ✗'} sx={{ fontSize: 10 }} />
              <Chip size="small" label={r.face_match_passed ? 'Visage ✓' : 'Visage ✗'} sx={{ fontSize: 10 }} />
              <Box
                onClick={() => busyId !== r.id && handleReview(r.id, true)}
                sx={{ px: 1.6, py: 0.8, borderRadius: 1.5, bgcolor: '#ecfdf5', color: '#059669', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Approuver
              </Box>
              <Box
                onClick={() => busyId !== r.id && handleReview(r.id, false)}
                sx={{ px: 1.6, py: 0.8, borderRadius: 1.5, bgcolor: '#fef2f2', color: '#dc2626', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
              >
                Rejeter
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
