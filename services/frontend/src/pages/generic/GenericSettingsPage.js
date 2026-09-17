import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext';

const ROLE_DESCRIPTIONS = {
  ADMIN: "Administre l'ensemble de la plateforme : acteurs, rôles, documents et workflows.",
  ISSUER: 'Émet des diplômes et attestations académiques pour ses étudiants.',
  VERIFIER: "Vérifie des documents et émet des attestations d'emploi pour ses employés.",
  BANK: 'Instruit les demandes de prêt et valide les dossiers KYC de ses clients.',
  NOTARY: 'Enregistre les titres fonciers et authentifie les transferts de propriété.',
  USER: 'Détient et partage ses documents et titres numériques.',
};

/**
 * Page "Paramètres" générique — volontairement en lecture seule : aucune préférence
 * (notifications, langue, etc.) n'est stockée aujourd'hui côté backend, donc on affiche
 * les vraies informations de compte plutôt que d'inventer des interrupteurs qui ne
 * feraient rien.
 */
export default function GenericSettingsPage() {
  const { user } = useAuth();

  const groups = [
    {
      title: 'Compte',
      items: [
        { label: 'Nom complet', value: user?.full_name },
        { label: 'Email', value: user?.email },
        { label: 'Rôle', value: user?.role },
      ],
    },
    {
      title: 'Identité numérique',
      items: [
        { label: 'Adresse blockchain', value: user?.address },
        { label: 'DID', value: user?.did, link: '/profile' },
      ],
    },
    {
      title: 'À propos de ce rôle',
      items: [{ label: ROLE_DESCRIPTIONS[user?.role] || '—', value: '' }],
    },
  ];

  return (
    <Box>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em' }}>Paramètres</Typography>
      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        {groups.map((g) => (
          <Grid item xs={12} md={6} key={g.title}>
            <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.5 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{g.title}</Typography>
              {g.items.map((it, i) => (
                <Box key={i} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, py: 1.6,
                  borderBottom: i < g.items.length - 1 ? '1px solid #f4f5fa' : 'none',
                }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 12.5, color: '#171a2b' }}>{it.label}</Typography>
                  </Box>
                  {it.value && (
                    <Typography sx={{ fontSize: 11.5, color: '#5b6070', fontWeight: 500, wordBreak: 'break-all', textAlign: 'right', maxWidth: 220 }}>
                      {it.value}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
