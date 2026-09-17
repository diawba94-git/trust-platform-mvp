import React from 'react';
import { Typography, Chip, Box } from '@mui/material';
import { timeAgo } from '../../utils/timeAgo';

/**
 * Liste compacte "titre / sous-titre / il y a X min", avec un badge de statut optionnel.
 * `items` = [{ title, subtitle, timestamp, statusLabel, statusColor }]. Limitée à `limit`
 * lignes (4 par défaut, comme la maquette) pour que le widget tienne sans scroll.
 */
export default function ActivityList({ items, limit = 4, emptyLabel = 'Aucune activité pour le moment.' }) {
  const visible = (items || []).slice(0, limit);
  if (visible.length === 0) {
    return <Typography sx={{ fontSize: 13, color: '#8a90a2' }}>{emptyLabel}</Typography>;
  }

  return (
    <Box>
      {visible.map((item, i) => (
        <Box
          key={i}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, py: 0.55,
            borderBottom: i < visible.length - 1 ? '1px solid #f4f5fa' : 'none',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 500 }} noWrap>{item.title}</Typography>
            {(item.subtitle || item.timestamp) && (
              <Typography sx={{ fontSize: 10.5, color: '#8a90a2', mt: 0.2 }} noWrap>
                {item.subtitle}{item.subtitle && item.timestamp ? ' · ' : ''}{item.timestamp && timeAgo(item.timestamp)}
              </Typography>
            )}
          </Box>
          {item.statusLabel && (
            <Chip size="small" label={item.statusLabel} color={item.statusColor || 'default'} sx={{ height: 20, fontSize: 10, flexShrink: 0 }} />
          )}
        </Box>
      ))}
    </Box>
  );
}
