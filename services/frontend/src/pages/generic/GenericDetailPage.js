import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert, Grid } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyDocument, getDocumentVersions, downloadDocument } from '../../services/api';
import { getDocTypeLabel, getDocTypeMeta } from '../../theme/docTypeLabels';
import { useAuth } from '../../context/AuthContext';
import { getRoleTheme } from '../../theme/roleThemes';

/** Vue détail d'un document — badge de statut, grille de champs, preuve blockchain,
 * actions. Alimentée par les endpoints déjà existants (verify + versions). */
export default function GenericDetailPage() {
  const { tokenId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [proof, setProof] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([verifyDocument(tokenId), getDocumentVersions(tokenId)])
      .then(([p, h]) => { setProof(p); setHistory(h); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tokenId]);

  async function handleDownload() {
    if (!proof?.ipfsCid) return;
    const blob = await downloadDocument(proof.ipfsCid);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `document-${tokenId}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!proof || !history) return null;

  const meta = getDocTypeMeta(proof.docType);
  const fields = [
    { label: 'Type', value: getDocTypeLabel(proof.docType) },
    { label: 'Référence', value: proof.docKey },
    { label: 'Token ID', value: tokenId },
    { label: 'Propriétaire', value: proof.owner_name || proof.owner },
    { label: 'Émetteur', value: proof.issuer_name || proof.issuer },
    ...(history.attributes || []).map((a) => ({ label: a.key, value: a.value })),
  ];

  return (
    <Box>
      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid item xs={12} md={7}>
          <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{
                  width: 40, height: 40, flexShrink: 0, borderRadius: '10px',
                  bgcolor: `${meta.color}1a`, color: meta.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <meta.icon sx={{ fontSize: 20 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{getDocTypeLabel(proof.docType)}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#8a90a2', mt: 0.5 }}>{proof.docKey}</Typography>
                </Box>
              </Box>
              <Box sx={{
                px: 1.4, py: 0.5, borderRadius: 999,
                bgcolor: proof.isValid ? '#ecfdf5' : '#fef2f2',
                color: proof.isValid ? '#059669' : '#dc2626',
                fontSize: 11, fontWeight: 700,
              }}>
                {proof.isValid ? 'Vérifié' : 'Invalide'}
              </Box>
            </Box>
            <Grid container spacing={0} sx={{ mt: 1 }}>
              {fields.map((f, i) => (
                <Grid item xs={6} key={i} sx={{ py: 1.5, borderBottom: '1px solid #f4f5fa' }}>
                  <Typography sx={{ fontSize: 11, color: '#8a90a2' }}>{f.label}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#171a2b', mt: 0.5 }}>{String(f.value)}</Typography>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ display: 'flex', gap: 1.25, mt: 2.5 }}>
              <Box
                onClick={() => navigate(`/documents/${tokenId}/history`)}
                sx={{ px: 2, py: 1.3, borderRadius: 2.5, bgcolor: theme.accent, color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}
              >
                Voir l'historique
              </Box>
              <Box
                onClick={handleDownload}
                sx={{ px: 2, py: 1.3, borderRadius: 2.5, border: '1px solid #e7e9f2', fontSize: 12.5, color: '#3b4054', cursor: 'pointer' }}
              >
                Télécharger le certificat
              </Box>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={12} md={5}>
          <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Preuve blockchain</Typography>
            <Box sx={{
              mt: 1.75, p: 1.75, borderRadius: 2, bgcolor: '#f6f7fb', border: '1px solid #eceef4',
              fontSize: 11, color: '#5b6070', lineHeight: 1.6, wordBreak: 'break-all',
            }}>
              {proof.ipfsCid}
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 2 }}>
              {[
                { label: 'Émetteur DID', value: proof.issuerDid },
                { label: 'Statut on-chain', value: proof.isValid ? 'Valide' : 'Invalide' },
                { label: 'Versions', value: history.versions?.length ?? 1 },
              ].map((d, i) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                  <Typography sx={{ color: '#8a90a2', fontSize: 12 }}>{d.label}</Typography>
                  <Typography sx={{ color: '#171a2b', fontWeight: 500, fontSize: 12, maxWidth: 200, wordBreak: 'break-all', textAlign: 'right' }}>
                    {String(d.value)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
