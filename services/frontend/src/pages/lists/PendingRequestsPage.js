import React from 'react';
import { Box, Typography } from '@mui/material';
import PendingVerificationsPanel from '../../components/PendingVerificationsPanel';

export default function PendingRequestsPage({ title, crumb }) {
  return (
    <Box sx={{ maxWidth: 900 }}>
      {crumb && (
        <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>{crumb}</Typography>
      )}
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: crumb ? 0.5 : 0, mb: 2.5 }}>
        {title}
      </Typography>
      <PendingVerificationsPanel title="Liste des demandes" />
    </Box>
  );
}
