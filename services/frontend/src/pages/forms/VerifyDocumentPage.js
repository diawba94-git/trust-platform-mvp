import React from 'react';
import { Box, Typography } from '@mui/material';
import DocumentVerifyPanel from '../../components/DocumentVerifyPanel';
import PendingVerificationsPanel from '../../components/PendingVerificationsPanel';

// "Vérifier un document" mêle deux besoins jusqu'ici séparés : vérifier l'authenticité
// on-chain d'un document donné (DocumentVerifyPanel, par Token ID/QR) et traiter les
// demandes de vérification qu'on nous a explicitement envoyées (PendingVerificationsPanel,
// accepter/refuser) — utile depuis que ces demandes (notamment pour un titre foncier)
// peuvent cibler n'importe quel acteur institutionnel, voire un autre citoyen.
export default function VerifyDocumentPage({ title, crumb }) {
  return (
    <Box sx={{ maxWidth: 1100 }}>
      {crumb && (
        <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>{crumb}</Typography>
      )}
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: crumb ? 0.5 : 0, mb: 2.5 }}>
        {title || 'Vérifier un document'}
      </Typography>
      <Box sx={{ mb: 2.5 }}>
        <PendingVerificationsPanel title="Demandes à vérifier" />
      </Box>
      <DocumentVerifyPanel title="Scanner ou déposer le document" />
    </Box>
  );
}
