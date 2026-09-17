import React from 'react';
import { Box, Typography, Link as MuiLink } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export default function SectionCard({ title, viewAllPath, children }) {
  return (
    <Box sx={{
      height: '100%', width: '100%', flex: 1, minWidth: 0, bgcolor: '#fff', border: '1px solid #eceef4',
      borderRadius: '14px', p: '13px', boxSizing: 'border-box',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.75 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{title}</Typography>
        {viewAllPath && (
          <MuiLink component={RouterLink} to={viewAllPath} underline="hover" sx={{ fontSize: 12 }}>
            Voir tout
          </MuiLink>
        )}
      </Box>
      {children}
    </Box>
  );
}
