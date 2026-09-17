import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Dialog, DialogTitle, DialogContent, Alert } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import jsQR from 'jsqr';
import { getRoleTheme } from '../theme/roleThemes';
import { useAuth } from '../context/AuthContext';

/**
 * Bouton "Scanner un QR code" + dialogue de scan — même flux que l'onglet "Scanner" du
 * wallet mobile (caméra en direct), avec un repli "Choisir une image" pour les postes sans
 * caméra (démo desktop). Décodage local via jsQR, aucune donnée envoyée à un serveur tiers.
 * `onScan(rawValue)` reçoit la chaîne brute lue dans le QR ; à l'appelant de la décoder
 * (cf. utils/qrPayload.js) et de lancer la vérification.
 */
export default function QrScanDialog({ onScan }) {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const [open, setOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function handleDecoded(value) {
    stopCamera();
    setOpen(false);
    onScan(value);
  }

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code?.data) {
      handleDecoded(code.data);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (!open) return;
    setCameraError('');
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        setCameraError("Caméra indisponible ou accès refusé — utilisez « Choisir une image » ci-dessous.");
      });
    return () => stopCamera();
  }, [open]);

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        handleDecoded(code.data);
      } else {
        setCameraError("Aucun QR code détecté dans cette image.");
      }
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  return (
    <>
      <Box
        onClick={() => setOpen(true)}
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 1, px: 2.25, py: 1.3, borderRadius: '10px',
          border: `1px solid ${theme.accent}`, color: theme.accent, fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
        }}
      >
        <QrCodeScannerIcon sx={{ fontSize: 17 }} /> Scanner un QR code
      </Box>

      <Dialog open={open} onClose={() => { stopCamera(); setOpen(false); }} maxWidth="xs" fullWidth>
        <DialogTitle>Scanner un QR code</DialogTitle>
        <DialogContent>
          <Box sx={{
            position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '12px', overflow: 'hidden',
            bgcolor: '#0b0f1e',
          }}>
            <Box component="video" ref={videoRef} muted playsInline sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <Box sx={{
              position: 'absolute', inset: '15%', border: `2px solid ${theme.accent}`, borderRadius: '16px',
              pointerEvents: 'none',
            }} />
          </Box>
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {cameraError && <Alert severity="info" sx={{ mt: 2 }}>{cameraError}</Alert>}

          <Typography sx={{ fontSize: 12, color: '#8a90a2', mt: 2, mb: 1 }}>
            Pas de caméra disponible ?
          </Typography>
          <Box component="label" sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 1.1, borderRadius: '9px',
            border: '1px solid #e7e9f2', fontSize: 12.5, color: '#3b4054', cursor: 'pointer',
          }}>
            <input type="file" accept="image/*" hidden onChange={handleFileChosen} />
            Choisir une image
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
