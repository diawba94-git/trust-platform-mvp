import React from 'react';
import { Card, CardActionArea, CardContent, Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function QuickActionCard({ icon, title, subtitle, path, accent, onClick }) {
  const navigate = useNavigate();
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea onClick={onClick || (() => navigate(path))} sx={{ height: '100%', p: 2 }}>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: 2, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              bgcolor: accent ? `${accent}22` : 'action.hover', color: accent || 'primary.main',
            }}>
              {icon}
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{title}</Typography>
              {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
