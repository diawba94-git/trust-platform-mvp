import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Alert, Grid } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import VerifiedIcon from '@mui/icons-material/Verified';
import { getDocumentVersions, downloadDocument } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../theme/roleThemes';

const formatDate = (timestamp) =>
  new Date(timestamp * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const formatDateTime = (timestamp) =>
  new Date(timestamp * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const shortenAddress = (address) => (address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : 'Inconnu');
const shortenCid = (cid) => (cid ? `${cid.substring(0, 10)}…${cid.substring(cid.length - 4)}` : '—');
const initials = (name) => (name ? name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '?');

function SectionCard({ title, children, sx }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.5, ...sx }}>
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: '#8a90a2', textTransform: 'uppercase', mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function PillButton({ onClick, disabled, accent, children, icon }) {
  return (
    <Box
      onClick={disabled ? undefined : onClick}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 1.2, borderRadius: '10px',
        bgcolor: accent, color: '#fff', fontSize: 12.5, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}{children}
    </Box>
  );
}

function OwnershipTimeline({ versions, onDownload, accent }) {
  // Affichage du plus récent au plus ancien — on garde le numéro de propriétaire calculé sur
  // l'ordre chronologique d'origine (#1 = tout premier propriétaire) avant d'inverser.
  const items = (versions || []).map((v, i) => ({ ...v, ownerNumber: i + 1 })).reverse();
  return (
    <Box>
      {items.map((version, index) => {
        const isLast = index === items.length - 1;
        return (
          <Box key={index} sx={{ display: 'flex', gap: 1.75 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 32 }}>
              <Box sx={{
                width: 30, height: 30, borderRadius: '999px', flexShrink: 0,
                bgcolor: version.is_current ? accent : '#e5e7eb', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700,
              }}>
                {initials(version.owner_name)}
              </Box>
              {!isLast && <Box sx={{ flex: 1, width: 2, bgcolor: '#eceef4', my: 0.5 }} />}
            </Box>
            <Box sx={{ flex: 1, pb: isLast ? 0 : 2.25 }}>
              <Typography sx={{ fontSize: 10.5, color: '#a3a8b8' }}>{formatDateTime(version.timestamp)}</Typography>
              <Box sx={{ mt: 0.5, p: 1.5, borderRadius: '10px', border: '1px solid #eceef4', bgcolor: version.is_current ? '#f9fafd' : 'transparent' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>
                    Propriétaire #{version.ownerNumber}
                    {version.is_current && (
                      <Box component="span" sx={{ ml: 1, px: 1, py: 0.3, borderRadius: 999, bgcolor: `${accent}1a`, color: accent, fontSize: 10, fontWeight: 700 }}>
                        Actuel
                      </Box>
                    )}
                  </Typography>
                  <Box onClick={() => onDownload(version.cid)} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: 11.5, color: accent, cursor: 'pointer' }}>
                    <DownloadIcon sx={{ fontSize: 14 }} /> PDF
                  </Box>
                </Box>
                <Typography sx={{ fontSize: 11.5, color: '#8a90a2', mt: 0.3 }}>
                  {version.owner_name && version.owner_name !== 'Inconnu' ? version.owner_name : shortenAddress(version.owner)}
                </Typography>
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// Vue enrichie pour les titres fonciers : fiche technique de la parcelle, historique de
// propriété et carte du propriétaire actuel — uniquement à partir de données réellement
// enregistrées (attributs, propriétaires successifs, CID IPFS). Pas de champs fictifs.
function LandTitleView({ tokenId, history, onDownload, accent }) {
  const attrs = Object.fromEntries((history.attributes || []).map((a) => [a.key, a.value]));
  const firstVersion = history.versions?.[0];
  const currentVersion = history.versions?.[history.versions.length - 1];

  return (
    <Box>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75, mb: 2.5 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: 12, color: '#8a90a2' }}>
                {history.doc_key || `TOKEN-${tokenId}`}
              </Typography>
              <Box sx={{
                px: 1.2, py: 0.3, borderRadius: 999, fontSize: 10.5, fontWeight: 700,
                bgcolor: history.is_active ? '#ecfdf5' : '#fef2f2', color: history.is_active ? '#059669' : '#dc2626',
              }}>
                {history.is_active ? 'Actif' : 'Révoqué'}
              </Box>
            </Box>
            <Typography sx={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{attrs.location || 'Titre foncier'}</Typography>
            <Typography sx={{ fontSize: 12.5, color: '#8a90a2', mt: 0.5 }}>
              Titre foncier · {attrs.location || '—'} · {attrs.landArea ? `${Number(attrs.landArea).toLocaleString('fr-FR')} m²` : '—'}
            </Typography>
          </Grid>
          <Grid item>
            <Box sx={{ textAlign: 'center' }}>
              <VerifiedIcon sx={{ fontSize: 44, color: history.is_active ? '#059669' : '#c2c6d4' }} />
              {firstVersion && (
                <Typography sx={{ fontSize: 10, color: '#a3a8b8', mt: 0.3 }}>SCELLÉ LE {formatDate(firstVersion.timestamp)}</Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <SectionCard title="Fiche technique de la parcelle" sx={{ mb: 2.5 }}>
            {[
              ['Référence', history.doc_key],
              ['Superficie', attrs.landArea ? `${Number(attrs.landArea).toLocaleString('fr-FR')} m²` : '—'],
              ['Localisation', attrs.location],
              ['Valeur estimée', attrs.value ? `${Number(attrs.value).toLocaleString('fr-FR')} FCFA` : '—'],
              ['Hash IPFS', shortenCid(currentVersion?.cid)],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid #f4f5fa' }}>
                <Typography sx={{ fontSize: 12, color: '#8a90a2' }}>{label}</Typography>
                <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>{value || '—'}</Typography>
              </Box>
            ))}
          </SectionCard>

          <SectionCard title="Historique de propriété">
            <OwnershipTimeline versions={history.versions} onDownload={onDownload} accent={accent} />
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={5}>
          <SectionCard title="Propriétaire actuel" sx={{ mb: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Box sx={{
                width: 38, height: 38, borderRadius: '999px', bgcolor: `${accent}1a`, color: accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13,
              }}>
                {initials(history.current_owner_name)}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 12.5, fontWeight: 500 }}>{history.current_owner_name || shortenAddress(history.current_owner)}</Typography>
                {currentVersion && (
                  <Typography sx={{ fontSize: 11, color: '#8a90a2' }}>Propriétaire depuis le {formatDate(currentVersion.timestamp)}</Typography>
                )}
              </Box>
            </Box>
            <Typography sx={{ fontSize: 10.5, color: '#a3a8b8' }}>DID</Typography>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 11.5, wordBreak: 'break-all', mt: 0.3 }}>
              {history.current_owner_did || shortenAddress(history.current_owner)}
            </Typography>
          </SectionCard>

          <SectionCard title="Certificat">
            <PillButton onClick={() => onDownload(currentVersion?.cid)} disabled={!currentVersion} accent={accent} icon={<DownloadIcon sx={{ fontSize: 16 }} />}>
              Télécharger le certificat
            </PillButton>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function DocumentHistory() {
  const { tokenId } = useParams();
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(null);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line
  }, [tokenId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      setHistory(await getDocumentVersions(tokenId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (cid) => {
    if (!cid) return;
    try {
      const blob = await downloadDocument(cid);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document_${cid.substring(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Erreur de téléchargement');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mb: 2.5 }}>
        Historique du document
      </Typography>

      {history?.doc_type === 'LAND_TITLE' ? (
        <LandTitleView tokenId={tokenId} history={history} onDownload={handleDownload} accent={theme.accent} />
      ) : (
        <Box>
          <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.5, mb: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Document #{tokenId}</Typography>
            <Box sx={{ px: 1.2, py: 0.4, borderRadius: 999, bgcolor: `${theme.accent}1a`, color: theme.accent, fontSize: 11, fontWeight: 600 }}>
              Propriétaire actuel : {history?.current_owner_name || shortenAddress(history?.current_owner)}
            </Box>
            <Box sx={{ px: 1.2, py: 0.4, borderRadius: 999, border: '1px solid #e7e9f2', fontSize: 11, color: '#5b6070' }}>
              {history?.versions?.length || 0} version(s)
            </Box>
          </Box>

          <SectionCard title="Historique des propriétaires">
            <OwnershipTimeline versions={history?.versions} onDownload={handleDownload} accent={theme.accent} />
          </SectionCard>
        </Box>
      )}
    </Box>
  );
}
