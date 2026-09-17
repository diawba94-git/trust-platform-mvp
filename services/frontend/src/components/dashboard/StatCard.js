import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Carte de statistique : icône (élément React, ex: <PeopleIcon/>), libellé, valeur, et delta
 * optionnel (ex: "+12 ce mois"). Densité calquée sur la maquette (padding/tailles réduits)
 * pour que 4 cartes + les widgets en dessous tiennent sans scroll.
 * `neutral` : le texte sous la valeur est une légende neutre ("En attente", "Total", "Ce
 * mois-ci" — gris) plutôt qu'un vrai delta positif ("↑ 12.5%", "+9 ce mois" — vert), comme
 * dans la maquette (Admin/Université ont de vrais deltas verts, Banque/Notaire/Utilisateur
 * affichent surtout des légendes neutres).
 */
export default function StatCard({ icon, label, value, deltaLabel, neutral, accent, iconSize = 44, iconRadius = '12px' }) {
  return (
    <Box sx={{
      height: '100%', bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px',
      p: '13px', display: 'flex', alignItems: 'center', gap: 1.5, boxSizing: 'border-box',
    }}>
      <Box
        sx={{
          width: iconSize, height: iconSize, flexShrink: 0, borderRadius: iconRadius,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: accent ? `${accent}1a` : 'action.hover',
          color: accent || 'text.secondary',
          fontSize: 20,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 11.5, color: '#8a90a2' }} noWrap>{label}</Typography>
        <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', mt: 0.3 }}>
          {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
        </Typography>
        {deltaLabel && (
          <Typography sx={{ fontSize: 11, color: neutral ? '#a3a8b8' : 'success.main', fontWeight: neutral ? 400 : 600, mt: 0.3 }} noWrap>
            {deltaLabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
