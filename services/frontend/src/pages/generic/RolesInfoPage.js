import React, { useEffect, useState } from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { getStatsOverview } from '../../services/api';

const ROLE_INFO = [
  { role: 'ADMIN', label: 'Administrateur', description: "Accès complet : gestion des acteurs, des documents et des workflows de la plateforme." },
  { role: 'ISSUER', label: 'Université', description: 'Émet des diplômes et attestations académiques, crée les DID de ses étudiants.' },
  { role: 'VERIFIER', label: 'Entreprise', description: "Vérifie des documents et émet des attestations d'emploi pour ses employés." },
  { role: 'BANK', label: 'Banque', description: 'Instruit les demandes de prêt et valide les dossiers KYC de ses clients.' },
  { role: 'NOTARY', label: 'Notaire', description: 'Enregistre les titres fonciers et authentifie les transferts de propriété.' },
  { role: 'USER', label: 'Citoyen', description: 'Détient, consulte et partage ses documents et titres numériques.' },
];

/** Page "Profils & Rôles" / "Rôles & Permissions" — volontairement descriptive et en
 * lecture seule : il n'existe pas de moteur de permissions granulaires dans ce projet
 * (6 rôles fixes), donc on documente ce qui existe réellement plutôt que d'inventer un
 * éditeur de droits qui n'aurait aucun effet. Les effectifs par rôle ne sont affichés que
 * pour ADMIN (seul rôle ayant une vue transverse, via /stats/overview).
 */
export default function RolesInfoPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      getStatsOverview().then((s) => {
        setCounts(Object.fromEntries(s.roles_breakdown.map((r) => [r.role, r.count])));
      }).catch(() => {});
    }
  }, [user]);

  return (
    <Box>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em' }}>
        {user?.role === 'ADMIN' ? 'Profils & Rôles' : 'Rôles & Permissions'}
      </Typography>
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        {ROLE_INFO.map((r) => (
          <Grid item xs={12} sm={6} md={4} key={r.role}>
            <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.5, height: '100%' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{r.label}</Typography>
              <Typography sx={{ fontSize: 12, color: '#8a90a2', mt: 1, lineHeight: 1.5 }}>{r.description}</Typography>
              {counts && (
                <Typography sx={{ fontSize: 22, fontWeight: 700, mt: 1.5 }}>{counts[r.role] || 0}</Typography>
              )}
            </Box>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
