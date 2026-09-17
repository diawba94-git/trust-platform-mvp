import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

/**
 * Courbe SVG faite main (sparkline étiquetée) : `data` = [{month, count}].
 */
export default function TrendLine({ data, color = '#4f46e5', height = 120 }) {
  const width = Math.max(280, data.length * 48);
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : width / 2;
    const y = height - (d.count / max) * (height - 20) - 10;
    return { x, y, ...d };
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1]?.x || 0} ${height} L ${points[0]?.x || 0} ${height} Z`;

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg width={width} height={height + 24} viewBox={`0 0 ${width} ${height + 24}`}>
        <path d={areaPath} fill={color} opacity={0.1} />
        <path d={path} fill="none" stroke={color} strokeWidth={2.5} />
        {points.map((p) => (
          <circle key={p.month} cx={p.x} cy={p.y} r={3.5} fill={color} />
        ))}
      </svg>
      <Stack direction="row" justifyContent="space-between" sx={{ width, px: 0.5 }}>
        {data.map((d) => (
          <Typography key={d.month} variant="caption" color="text.secondary">{d.month}</Typography>
        ))}
      </Stack>
    </Box>
  );
}
