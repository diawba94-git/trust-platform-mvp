import React, { useState, useEffect } from 'react';
import { Box, Typography, Alert, CircularProgress, IconButton, Snackbar, Grid } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { getMyCredentials } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../theme/roleThemes';

const ROLE_LABELS = {
  ADMIN: 'Administrateur', ISSUER: 'Université', VERIFIER: 'Entreprise',
  BANK: 'Banque', NOTARY: 'Notaire', USER: 'Citoyen',
};

/** "Mon identité" — reprend le patron générique "isDetail" de la maquette (fil d'ariane,
 * grille de champs 2 colonnes, badge de statut, panneau latéral) appliqué aux vraies
 * données d'identité (DID, adresse, clé privée) plutôt qu'à un document. */
export default function Profile() {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  useEffect(() => {
    if (user) loadCredentials();
  }, [user]);

  const loadCredentials = async () => {
    setLoading(true);
    setError(null);
    try {
      setCredentials(await getMyCredentials());
    } catch (err) {
      setError(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSnackbar({ open: true, message: '📋 Copié !' });
  };

  if (!user) return <Alert severity="info">Veuillez vous connecter</Alert>;
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

  const fields = [
    { label: 'Nom complet', value: user.full_name },
    { label: 'Email', value: user.email },
    { label: 'Rôle', value: ROLE_LABELS[user.role] || user.role },
    { label: 'DID', value: credentials?.did },
  ];

  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>
        {theme.badge || ROLE_LABELS[user.role]} · Identité
      </Typography>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: 0.5, mb: 2.5 }}>
        Mon identité
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid item xs={12} md={7}>
          <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography sx={{ fontSize: 16, fontWeight: 700 }}>{user.full_name}</Typography>
                <Typography sx={{ fontSize: 12, color: '#8a90a2', mt: 0.5 }}>Identité numérique</Typography>
              </Box>
              <Box sx={{ px: 1.4, py: 0.5, borderRadius: 999, bgcolor: '#ecfdf5', color: '#059669', fontSize: 11, fontWeight: 700 }}>
                Vérifiée
              </Box>
            </Box>
            <Grid container sx={{ mt: 1 }}>
              {fields.map((f, i) => (
                <Grid item xs={12} sm={6} key={i} sx={{ py: 1.5, borderBottom: '1px solid #f4f5fa' }}>
                  <Typography sx={{ fontSize: 11, color: '#8a90a2' }}>{f.label}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#171a2b', mt: 0.5, wordBreak: 'break-all' }}>
                    {f.value || '—'}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.5 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Identifiants</Typography>

            {credentials && (
              <>
                <Box sx={{ mt: 1.75 }}>
                  <Typography sx={{ fontSize: 11, color: '#8a90a2' }}>Adresse blockchain</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Typography sx={{ fontFamily: 'monospace', fontSize: 11, color: '#5b6070', wordBreak: 'break-all', flex: 1 }}>
                      {credentials.address}
                    </Typography>
                    <IconButton size="small" onClick={() => copyToClipboard(credentials.address)}>
                      <ContentCopyIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Box>
                </Box>

                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>⚠️ Clé privée</Typography>
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, p: '10px 12px',
                    borderRadius: '9px', bgcolor: '#f6f7fb', border: '1px solid #eceef4',
                  }}>
                    <Typography sx={{
                      fontFamily: 'monospace', fontSize: 10.5, wordBreak: 'break-all', flex: 1,
                      filter: showPrivateKey ? 'none' : 'blur(4px)', userSelect: showPrivateKey ? 'text' : 'none',
                    }}>
                      {credentials.private_key}
                    </Typography>
                    <IconButton size="small" onClick={() => setShowPrivateKey(!showPrivateKey)}>
                      {showPrivateKey ? <VisibilityOffIcon sx={{ fontSize: 15 }} /> : <VisibilityIcon sx={{ fontSize: 15 }} />}
                    </IconButton>
                    <IconButton size="small" onClick={() => copyToClipboard(credentials.private_key)}>
                      <ContentCopyIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Box>
                  <Typography sx={{ fontSize: 10.5, color: '#a3a8b8', mt: 1 }}>
                    🔒 Cette clé privée est personnelle. Ne la partagez avec personne.
                  </Typography>
                </Box>
              </>
            )}
          </Box>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        message={snackbar.message}
      />
    </Box>
  );
}
