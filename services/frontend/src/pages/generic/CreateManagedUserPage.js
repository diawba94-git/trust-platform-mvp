import React, { useState } from 'react';
import { Box, Typography, TextField, Alert, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { getRoleTheme } from '../../theme/roleThemes';
import { createManagedUser } from '../../services/api';

// VERIFIER (entreprise) peut créer soit un employé (USER, reçoit des attestations), soit
// un autre représentant de l'entreprise (VERIFIER, mêmes droits qu'un responsable RH) —
// ISSUER (université) ne crée que des étudiants (USER), pas de choix à proposer.
const VERIFIER_ROLE_OPTIONS = [
  { value: 'USER', label: 'Employé' },
  { value: 'VERIFIER', label: "Représentant de l'entreprise" },
];

// ISSUER (étudiant) et BANK (client) ne créent que des comptes USER — pas de choix de
// rôle à proposer, contrairement à VERIFIER qui peut aussi ajouter un représentant.
const PERSON_LABELS = { ISSUER: 'étudiant', BANK: 'client' };

/** "Établir DID" — ISSUER crée un compte USER "étudiant", BANK un compte USER "client",
 * VERIFIER un compte USER "employé" ou VERIFIER "représentant"
 * (POST /actors/create-managed-user). */
export default function CreateManagedUserPage() {
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const isVerifier = user?.role === 'VERIFIER';
  const [targetRole, setTargetRole] = useState('USER');
  const personLabel = PERSON_LABELS[user?.role] || (targetRole === 'VERIFIER' ? 'représentant' : 'employé');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [placeOfBirth, setPlaceOfBirth] = useState('');
  const [nationalIdNumber, setNationalIdNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [existsDialogOpen, setExistsDialogOpen] = useState(false);
  // Identité civile exigée uniquement pour un compte USER (étudiant/employé) — un
  // représentant VERIFIER supplémentaire n'en a pas besoin, comme côté Admin.
  const targetIsCitizen = (isVerifier ? targetRole : 'USER') === 'USER';
  const isFormValid = email
    && (targetIsCitizen ? (lastName && firstName) : fullName)
    && (!targetIsCitizen || (dateOfBirth && placeOfBirth && nationalIdNumber));

  async function handleSubmit() {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await createManagedUser({
        email,
        full_name: targetIsCitizen ? `${firstName} ${lastName}`.trim() : fullName,
        first_name: targetIsCitizen ? firstName : undefined,
        last_name: targetIsCitizen ? lastName : undefined,
        date_of_birth: targetIsCitizen ? dateOfBirth : undefined,
        place_of_birth: targetIsCitizen ? placeOfBirth : undefined,
        national_id_number: targetIsCitizen ? nationalIdNumber : undefined,
        role: isVerifier ? targetRole : 'USER',
      });
      setResult(res);
      if (res.already_existed) setExistsDialogOpen(true);
      setEmail('');
      setFullName('');
      setLastName('');
      setFirstName('');
      setDateOfBirth('');
      setPlaceOfBirth('');
      setNationalIdNumber('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box sx={{ maxWidth: 640 }}>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mb: 2.5 }}>Établir DID</Typography>
      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 700, mb: 2 }}>
          Créer l'identité numérique d'un {personLabel}
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {result && !result.already_existed && (
          <Alert severity="success" sx={{ mb: 2 }}>
            DID créé : {result.did} — clé privée transmise une seule fois : {result.private_key}
          </Alert>
        )}

        {isVerifier && (
          <Box sx={{ display: 'flex', gap: 1.25, mb: 2.5 }}>
            {VERIFIER_ROLE_OPTIONS.map((o) => (
              <Box
                key={o.value}
                onClick={() => setTargetRole(o.value)}
                sx={{
                  px: 1.75, py: 1, borderRadius: 2, fontSize: 12.5, cursor: 'pointer',
                  border: `1px solid ${targetRole === o.value ? theme.accent : '#e7e9f2'}`,
                  bgcolor: targetRole === o.value ? `${theme.accent}14` : '#fff',
                  color: targetRole === o.value ? theme.accent : '#3b4054',
                  fontWeight: targetRole === o.value ? 600 : 400,
                }}
              >
                {o.label}
              </Box>
            ))}
          </Box>
        )}

        <TextField fullWidth size="small" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
        {targetIsCitizen ? (
          <>
            <TextField fullWidth size="small" label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} sx={{ mb: 2 }} />
            <TextField fullWidth size="small" label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} sx={{ mb: 2 }} />
          </>
        ) : (
          <TextField fullWidth size="small" label="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} sx={{ mb: 2.5 }} />
        )}
        {targetIsCitizen && (
          <>
            <TextField
              fullWidth size="small" label="Date de naissance" type="date" InputLabelProps={{ shrink: true }}
              value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} sx={{ mb: 2 }}
            />
            <TextField fullWidth size="small" label="Lieu de naissance" value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} sx={{ mb: 2 }} />
            <TextField
              fullWidth size="small" label="N° carte d'identité (CNI)" value={nationalIdNumber}
              onChange={(e) => setNationalIdNumber(e.target.value)} sx={{ mb: 2.5 }}
            />
          </>
        )}
        <Box
          onClick={!loading && isFormValid ? handleSubmit : undefined}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.3, borderRadius: 2.5,
            bgcolor: theme.accent, color: '#fff', fontSize: 12.5, fontWeight: 500,
            cursor: isFormValid ? 'pointer' : 'not-allowed', opacity: isFormValid ? 1 : 0.5,
          }}
        >
          {loading ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : `Créer le DID ${personLabel}`}
        </Box>
      </Box>

      <Dialog open={existsDialogOpen} onClose={() => setExistsDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: 15, fontWeight: 700 }}>ℹ️ DID déjà existant</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 13, color: '#3b4054' }}>
            Cette personne a déjà un DID ({result?.did}) — aucun doublon n'a été créé, elle vient d'être
            rattachée à votre organisation. Elle apparaît désormais dans "Mes {personLabel}s" pour l'émission
            de documents.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setExistsDialogOpen(false)} sx={{ textTransform: 'none', color: theme.accent }}>
            Compris
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
