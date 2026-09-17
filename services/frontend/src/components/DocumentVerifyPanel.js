import React, { useState } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Link } from 'react-router-dom';
import { verifyDocument, verifyDocumentFile, verifyDocumentAuto } from '../services/api';
import { getDocTypeLabel } from '../theme/docTypeLabels';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../theme/roleThemes';
import QrScanDialog from './QrScanDialog';
import { decodeWalletQrPayload, InvalidQrPayloadError } from '../utils/qrPayload';

// Panneau réutilisable : vérifie un document par Token ID (statut on-chain), et
// optionnellement un fichier fourni par l'utilisateur (détection de falsification en
// comparant son CID IPFS à celui enregistré on-chain) — patron "Vérification" générique
// de la maquette : zone de dépôt à gauche, résultat à droite.
export default function DocumentVerifyPanel({ title = 'Vérifier un document' }) {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [tokenId, setTokenId] = useState('');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [fileResult, setFileResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleVerify(idOverride) {
    const id = idOverride ?? tokenId;
    if (!id && !file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setFileResult(null);
    try {
      if (!id && file) {
        // Pas de Token ID saisi : le fichier déposé est identifié automatiquement à partir
        // de son empreinte IPFS (aucun besoin de lire/scanner le QR pour ça).
        const autoResult = await verifyDocumentAuto(file);
        setTokenId(String(autoResult.token_id));
        setResult(autoResult);
        setFileResult({ match: autoResult.match, computed_cid: autoResult.computed_cid, onchain_cid: autoResult.ipfsCid });
      } else {
        const docResult = await verifyDocument(parseInt(id, 10));
        setResult(docResult);
        if (file) {
          setFileResult(await verifyDocumentFile(parseInt(id, 10), file));
        }
      }
    } catch (err) {
      setError(err.message || 'Erreur lors de la vérification');
    } finally {
      setLoading(false);
    }
  }

  function handleScan(rawValue) {
    setFile(null);
    try {
      const payload = decodeWalletQrPayload(rawValue);
      setTokenId(String(payload.tokenId));
      setError(null);
      handleVerify(payload.tokenId);
    } catch (err) {
      setResult(null);
      setError(err instanceof InvalidQrPayloadError ? err.message : 'QR code illisible.');
    }
  }

  const authentic = result?.isValid && (!file || fileResult?.match);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1.3fr' }, gap: 2.5, alignItems: 'flex-start' }}>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, textAlign: 'left' }}>{title}</Typography>

        <Box sx={{ textAlign: 'left', mt: 2 }}>
          <Typography sx={{ fontSize: 11.5, color: '#5b6070', fontWeight: 500, mb: 0.75 }}>
            ID du document (Token ID) — inutile si vous déposez le fichier ci-dessous
          </Typography>
          <Box
            component="input"
            type="number"
            value={tokenId}
            onChange={(e) => { setTokenId(e.target.value); setResult(null); setFileResult(null); }}
            sx={{
              width: '100%', boxSizing: 'border-box', p: '11px 13px', borderRadius: '9px',
              border: '1px solid #e7e9f2', bgcolor: '#fbfcfe', fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
            }}
          />
        </Box>

        <Box
          component="label"
          sx={{
            display: 'block', mt: 2.25, p: '34px 20px', borderRadius: '12px',
            border: '1.5px dashed #cfd4e6', bgcolor: '#fbfcfe', cursor: 'pointer',
          }}
        >
          <input type="file" hidden onChange={(e) => { setFile(e.target.files[0] || null); setFileResult(null); }} />
          <Box sx={{
            width: 52, height: 52, mx: 'auto', borderRadius: '14px', bgcolor: `${theme.accent}1a`, color: theme.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UploadFileIcon sx={{ fontSize: 24 }} />
          </Box>
          <Typography sx={{ fontSize: 12.5, color: '#5b6070', mt: 1.75 }}>
            {file ? file.name : 'Déposez le fichier à vérifier'}
          </Typography>
          <Typography sx={{ fontSize: 11, color: '#a3a8b8', mt: 0.5 }}>
            PDF, PNG ou JPG — 10 Mo max — le document est identifié automatiquement
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.25, mt: 2.25, flexWrap: 'wrap' }}>
          <Box
            onClick={(!tokenId && !file) || loading ? undefined : () => handleVerify()}
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.3, borderRadius: '10px',
              bgcolor: theme.accent, color: '#fff', fontSize: 12.5, fontWeight: 500,
              cursor: (!tokenId && !file) || loading ? 'not-allowed' : 'pointer', opacity: (!tokenId && !file) || loading ? 0.5 : 1,
            }}
          >
            {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Vérifier'}
          </Box>
          <QrScanDialog onScan={handleScan} />
        </Box>

        {error && <Alert severity="error" sx={{ mt: 2, textAlign: 'left' }}>{error}</Alert>}
      </Box>

      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75 }}>
        {!result ? (
          <Typography sx={{ fontSize: 13, color: '#8a90a2' }}>
            Renseignez un Token ID, déposez un fichier, ou scannez un QR pour voir le résultat ici.
          </Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{
                width: 42, height: 42, borderRadius: '999px', flexShrink: 0,
                bgcolor: authentic ? '#ecfdf5' : '#fef2f2', color: authentic ? '#059669' : '#dc2626',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {authentic ? '✓' : '✕'}
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 700, color: authentic ? '#047857' : '#b3261e' }}>
                  {authentic ? 'Document authentique' : 'Document invalide ou modifié'}
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#8a90a2', mt: 0.3 }}>
                  {authentic ? 'Signature vérifiée sur la blockchain TrustWedge' : 'La vérification a échoué — voir le détail ci-dessous'}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', mt: 2.25 }}>
              {[
                { label: 'Token ID', value: `#${result.token_id ?? tokenId}` },
                { label: 'Statut on-chain', value: result.isValid ? 'Valide' : 'Invalide' },
                { label: 'Type', value: getDocTypeLabel(result.docType) },
                { label: 'Émetteur', value: result.issuer_name || result.issuer },
                { label: 'Propriétaire', value: result.owner_name || result.owner },
                ...(file ? [{ label: 'Fichier fourni', value: fileResult?.match ? 'Correspond au contenu on-chain' : 'Ne correspond pas' }] : []),
              ].map((d, i, arr) => (
                <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', py: 1.5, borderBottom: i < arr.length - 1 ? '1px solid #f4f5fa' : 'none' }}>
                  <Typography sx={{ fontSize: 12, color: '#8a90a2' }}>{d.label}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#171a2b', fontWeight: 500 }}>{d.value}</Typography>
                </Box>
              ))}
            </Box>

            {result.isValid && result.docType === 'LAND_TITLE' && (
              <Box
                component={Link}
                to={`/documents/${tokenId}/history`}
                sx={{ display: 'inline-block', mt: 2, fontSize: 12.5, color: theme.accent, textDecoration: 'none' }}
              >
                Voir l'historique →
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
