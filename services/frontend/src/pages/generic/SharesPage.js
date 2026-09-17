import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Chip } from '@mui/material';
import { Link } from 'react-router-dom';
import { getMyShares, revokeShare } from '../../services/api';

function shareStatus(s) {
  if (s.revoked) return { label: 'Révoqué', color: 'default' };
  if (s.expires_at && new Date(s.expires_at) < new Date()) return { label: 'Expiré', color: 'default' };
  return { label: 'Actif', color: 'success' };
}

/** "Mes partages" — liens créés depuis le wallet mobile (écran Partages), gérés
 * (consultation + révocation) ici aussi côté web via les mêmes endpoints (shares.py). */
export default function SharesPage() {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getMyShares().then(setShares).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRevoke(token) {
    try {
      await revokeShare(token);
      setShares((s) => s.map((sh) => (sh.share_token === token ? { ...sh, revoked: true } : sh)));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <Box>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em' }}>Mes partages</Typography>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', mt: 2.5, overflow: 'hidden' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : shares.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: 'center', color: '#8a90a2', fontSize: 13 }}>
            Aucun partage — créez-en un depuis le wallet mobile (fiche d'un document → "Partager par lien").
          </Typography>
        ) : (
          shares.map((s, i) => {
            const status = shareStatus(s);
            return (
              <Box key={s.share_token} sx={{
                display: 'flex', alignItems: 'center', gap: 2, px: 2.25, py: 1.75,
                borderBottom: i < shares.length - 1 ? '1px solid #f4f5fa' : 'none',
              }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography component={Link} to={`/documents/${s.token_id}/history`} sx={{ fontSize: 12.5, fontWeight: 500, color: '#171a2b', textDecoration: 'none' }}>
                    Document #{s.token_id}
                  </Typography>
                  <Typography sx={{ fontSize: 10.5, color: '#a3a8b8', mt: 0.3 }}>
                    Accès {s.access_level} · créé le {new Date(s.created_at).toLocaleDateString('fr-FR')}
                    {s.expires_at && ` · expire le ${new Date(s.expires_at).toLocaleDateString('fr-FR')}`}
                  </Typography>
                </Box>
                <Chip size="small" label={status.label} color={status.color} />
                {status.label === 'Actif' && (
                  <Box
                    onClick={() => handleRevoke(s.share_token)}
                    sx={{ px: 1.6, py: 0.8, borderRadius: 1.5, bgcolor: '#fef2f2', color: '#dc2626', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Révoquer
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
