import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

const PALETTE = ['#4f46e5', '#16a34a', '#d97706', '#2563eb', '#dc2626', '#7c3aed', '#0891b2'];

/**
 * Donut SVG fait main (pas de dépendance de charting) : `data` = [{label, count}].
 * Évite d'ajouter une lib de graphes après les galères de résolution de versions déjà
 * vécues sur ce projet (webpack/MUI) — un donut n'a besoin que d'un cercle de <circle>
 * avec des dash-offsets.
 */
export default function DonutChart({ data, size = 92, thickness = 17 }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offsetAcc = 0;
  const segments = data.map((d, i) => {
    const fraction = total > 0 ? d.count / total : 0;
    const length = fraction * circumference;
    const segment = {
      ...d,
      color: PALETTE[i % PALETTE.length],
      dashArray: `${length} ${circumference - length}`,
      dashOffset: -offsetAcc,
    };
    offsetAcc += length;
    return segment;
  });

  return (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#eee" strokeWidth={thickness} />
          {segments.map((s) => (
            <circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={s.dashArray}
              strokeDashoffset={s.dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ))}
        </svg>
        <Box sx={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontWeight: 700, lineHeight: 1, fontSize: 15 }}>{total}</Typography>
          <Typography sx={{ fontSize: 9.5, color: 'text.secondary' }}>total</Typography>
        </Box>
      </Box>
      <Box sx={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        columnGap: 1.5, rowGap: 0.5, flex: 1, minWidth: 0,
      }}>
        {segments.map((s) => (
          <Stack key={s.label} direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <Box sx={{ width: 7, height: 7, flexShrink: 0, borderRadius: '50%', bgcolor: s.color }} />
            <Typography sx={{ fontSize: 10.5, color: '#3b4054', flex: 1 }} noWrap>{s.label}</Typography>
            <Typography sx={{ fontSize: 10.5, color: '#8a90a2' }}>{s.count.toLocaleString('fr-FR')}</Typography>
          </Stack>
        ))}
      </Box>
    </Stack>
  );
}
