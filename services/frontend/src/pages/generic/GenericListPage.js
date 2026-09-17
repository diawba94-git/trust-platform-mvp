import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { getRoleTheme } from '../../theme/roleThemes';
import { useAuth } from '../../context/AuthContext';

/**
 * Page "liste" générique (recherche + puces de statut + tableau + clic sur une ligne) —
 * réutilisée pour toutes les listes des maquettes (Utilisateurs, Notaires, Universités,
 * Employés, Étudiants, Diplômes, Attestations, Titres fonciers, Demandes & Workflows,
 * Demandes KYC, Mes partages...). `fetcher` renvoie les lignes brutes ; `columns` décrit
 * les colonnes affichées ; `statusKey` (optionnel) active les puces de filtre par statut.
 */
export default function GenericListPage({
  title,
  crumb,
  fetcher,
  columns,
  searchKeys = [],
  statusKey,
  onRowClick,
  actionLabel,
  actionPath,
  emptyLabel = 'Aucun résultat.',
  rowIcon,
}) {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => { if (!cancelled) setRows(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetcher]);

  const statuses = useMemo(() => {
    if (!statusKey) return [];
    return ['Tous', ...Array.from(new Set(rows.map((r) => String(r[statusKey])))).filter(Boolean)];
  }, [rows, statusKey]);

  const filtered = useMemo(() => {
    let data = rows;
    if (statusKey && statusFilter !== 'Tous') {
      data = data.filter((r) => String(r[statusKey]) === statusFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
    }
    return data;
  }, [rows, search, statusFilter, statusKey, searchKeys]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3 }}>
        <Box>
          {crumb && (
            <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>{crumb}</Typography>
          )}
          <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: 0.5 }}>{title}</Typography>
        </Box>
        {actionLabel && actionPath && (
          <Box
            onClick={() => navigate(actionPath)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.3, borderRadius: 2.5,
              bgcolor: theme.accent, color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
              '&:hover': { opacity: 0.9 },
            }}
          >
            <AddIcon sx={{ fontSize: 16 }} /> {actionLabel}
          </Box>
        )}
      </Box>

      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', mt: 2.5, overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderBottom: '1px solid #f0f1f7', flexWrap: 'wrap' }}>
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 1, flex: '0 1 300px', px: 1.6, py: 1.1,
            borderRadius: 2, bgcolor: '#f6f7fb', border: '1px solid #eceef4',
          }}>
            <SearchIcon sx={{ fontSize: 16, color: '#b6bacb' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12.5, width: '100%', color: '#3b4054' }}
            />
          </Box>
          {statuses.map((s) => (
            <Box
              key={s}
              onClick={() => setStatusFilter(s)}
              sx={{
                px: 1.6, py: 1, borderRadius: 2, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${statusFilter === s ? theme.accent : '#e7e9f2'}`,
                bgcolor: statusFilter === s ? `${theme.accent}14` : '#fff',
                color: statusFilter === s ? theme.accent : '#3b4054',
                fontWeight: statusFilter === s ? 600 : 400,
              }}
            >
              {s}
            </Box>
          ))}
          <Box sx={{ flex: 1 }} />
          <Typography sx={{ fontSize: 11.5, color: '#8a90a2' }}>{filtered.length} résultat(s)</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.75, px: 2, py: 1.3, bgcolor: '#f9fafd', borderBottom: '1px solid #f0f1f7' }}>
          {rowIcon && <Box sx={{ width: 32, flexShrink: 0 }} />}
          {columns.map((c) => (
            <Typography key={c.key} sx={{ flex: 1, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', color: '#8a90a2' }}>
              {c.label}
            </Typography>
          ))}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : filtered.length === 0 ? (
          <Typography sx={{ p: 3, textAlign: 'center', color: '#8a90a2', fontSize: 13 }}>{emptyLabel}</Typography>
        ) : (
          filtered.map((row, i) => {
            const meta = rowIcon ? rowIcon(row) : null;
            const MetaIcon = meta?.icon;
            return (
              <Box
                key={row.id ?? row.token_id ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.75, px: 2, py: 1.75, borderBottom: '1px solid #f4f5fa',
                  cursor: onRowClick ? 'pointer' : 'default',
                  '&:hover': onRowClick ? { bgcolor: '#f9fafd' } : undefined,
                }}
              >
                {meta && (
                  <Box sx={{
                    width: 32, height: 32, flexShrink: 0, borderRadius: '9px',
                    bgcolor: `${meta.color}1a`, color: meta.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <MetaIcon sx={{ fontSize: 17 }} />
                  </Box>
                )}
                {columns.map((c) => (
                  <Typography
                    key={c.key}
                    sx={{ flex: 1, fontSize: 12.5, color: '#3b4054', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {c.render ? c.render(row) : row[c.key]}
                  </Typography>
                ))}
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
}
