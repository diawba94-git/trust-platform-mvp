import React, { useEffect, useState } from 'react';
import { Box, Grid, Typography, CircularProgress, Alert } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../theme/roleThemes';
import { getMyCredentials, getNetworkStatus, getRecentActivity, API_URL } from '../services/api';
import { timeAgo } from '../utils/timeAgo';

const ROLE_LABELS = {
  ADMIN: 'Administrateur', ISSUER: 'Université', VERIFIER: 'Entreprise',
  BANK: 'Banque', NOTARY: 'Notaire', USER: 'Citoyen',
};

function Card({ title, children }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.5, height: '100%', boxSizing: 'border-box' }}>
      <Typography sx={{ fontSize: 13.5, fontWeight: 700, mb: 1.5 }}>{title}</Typography>
      {children}
    </Box>
  );
}

function Row({ label, value, last }) {
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, py: 1.4,
      borderBottom: last ? 'none' : '1px solid #f4f5fa',
    }}>
      <Typography sx={{ fontSize: 12.5, color: '#171a2b', flex: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: 11.5, color: '#5b6070', fontWeight: 500, wordBreak: 'break-all', textAlign: 'right', maxWidth: 260 }}>
        {value ?? '—'}
      </Typography>
    </Box>
  );
}

/** Console technique — remplace les 6 tableaux de bord par rôle : identité numérique
 * (DID/clés, renvoie vers "Mon identité" pour la clé privée), informations d'intégration
 * de l'API, et journal d'activité (déjà scopé au rôle par /stats/activity). Commune à tous
 * les rôles authentifiés — aucune donnée ni action spécifique à un métier. */
export default function Console() {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [credentials, setCredentials] = useState(null);
  const [network, setNetwork] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getMyCredentials(), getNetworkStatus(), getRecentActivity(30)])
      .then(([creds, net, activity]) => {
        setCredentials(creds);
        setNetwork(net);
        setLogs(activity);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>
        {theme.badge || ROLE_LABELS[user?.role]}
      </Typography>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: 0.5, mb: 2.5 }}>
        Console technique
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
      ) : (
        <>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Card title="Identité numérique">
                <Row label="Nom complet" value={user?.full_name} />
                <Row label="Email" value={user?.email} />
                <Row label="Rôle" value={ROLE_LABELS[user?.role] || user?.role} />
                <Row label="Adresse blockchain" value={credentials?.address} />
                <Row label="DID" value={credentials?.did} last />
                <Typography sx={{ fontSize: 11, mt: 1.5 }}>
                  <RouterLink to="/profile" style={{ color: theme.accent }}>
                    Voir mes identifiants (clé privée) →
                  </RouterLink>
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card title="API & intégrations">
                <Row label="URL de base de l'API" value={API_URL} />
                <Row label="Réseau blockchain" value={network?.connected ? 'Connecté' : 'Déconnecté'} />
                <Row label="Bloc courant" value={network?.block_number} />
                <Row label="Chain ID" value={network?.chain_id} />
                <Row label="Adresse du contrat" value={network?.contract_address} last />
              </Card>
            </Grid>

            <Grid item xs={12}>
              <Card title="Journal d'activités">
                {logs.length === 0 ? (
                  <Typography sx={{ color: '#8a90a2', fontSize: 13 }}>Aucune activité pour le moment.</Typography>
                ) : (
                  logs.map((l, i) => (
                    <Box key={i} sx={{ display: 'flex', gap: 1.75, py: 1.5, borderBottom: i < logs.length - 1 ? '1px solid #f4f5fa' : 'none' }}>
                      <Box sx={{ width: 9, height: 9, mt: 0.7, flexShrink: 0, borderRadius: '50%', bgcolor: theme.accent }} />
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{l.message}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: 11, color: '#a3a8b8', whiteSpace: 'nowrap' }}>{timeAgo(l.timestamp)}</Typography>
                    </Box>
                  ))
                )}
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
