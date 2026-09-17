import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { getMyDocuments } from '../../services/api';
import { getDocTypeLabel, getDocTypeMeta } from '../../theme/docTypeLabels';

/** Regroupe les documents par type (Diplômes, Titres fonciers, ...) plutôt qu'une liste
 * plate — plus lisible quand un citoyen détient des documents de nature très différente. */
function groupByType(documents) {
  const groups = new Map();
  for (const doc of documents) {
    const key = doc.doc_type;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }
  return Array.from(groups.entries()).map(([doc_type, docs]) => ({ doc_type, docs }));
}

/** "Tous mes documents" — tous les documents détenus par le citoyen, groupés par type
 * (titres fonciers, diplômes, attestations, pièces d'identité), avec accès à l'historique
 * complet d'un document au clic sur une ligne. */
export default function MyDocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getMyDocuments()
      .then((data) => { if (!cancelled) setDocuments(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const groups = groupByType(documents);

  return (
    <Box>
      <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>Mon espace</Typography>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: 0.5, mb: 2.5 }}>
        Tous mes documents
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={22} /></Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : documents.length === 0 ? (
        <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 3 }}>
          <Typography sx={{ color: '#8a90a2', fontSize: 13, textAlign: 'center' }}>
            Aucun document pour le moment.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', overflow: 'hidden' }}>
          {groups.map(({ doc_type, docs }, gi) => (
            <Box key={doc_type} sx={{ borderTop: gi > 0 ? '1px solid #f0f1f7' : 'none' }}>
              <Typography sx={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: '#8a90a2',
                textTransform: 'uppercase', px: 2.5, pt: 2, pb: 1,
              }}>
                {getDocTypeLabel(doc_type)}
              </Typography>
              {docs.map((doc, i) => {
                const meta = getDocTypeMeta(doc_type);
                const MetaIcon = meta?.icon;
                return (
                  <Box
                    key={doc.id ?? doc.token_id ?? i}
                    onClick={() => navigate(`/documents/${doc.token_id}/history`)}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.75, px: 2.5, py: 1.75,
                      borderTop: i > 0 ? '1px solid #f4f5fa' : 'none',
                      cursor: 'pointer',
                      '&:hover': { bgcolor: '#f9fafd' },
                    }}
                  >
                    {MetaIcon && (
                      <Box sx={{
                        width: 32, height: 32, flexShrink: 0, borderRadius: '9px',
                        bgcolor: `${meta.color}1a`, color: meta.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <MetaIcon sx={{ fontSize: 17 }} />
                      </Box>
                    )}
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#171a2b' }}>
                        {getDocTypeLabel(doc_type)}
                      </Typography>
                      <Typography sx={{
                        fontSize: 12, color: '#8a90a2', mt: 0.25,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {doc.doc_key} · Émis par {doc.issuer}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
