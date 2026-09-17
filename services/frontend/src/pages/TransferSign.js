import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { getRoleTheme } from '../theme/roleThemes';
import { getWorkflowStatus, acceptTransfer, finalizeTransfer } from '../services/api';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

const STEPS = ['Vendeur signe', 'Acheteur signe', 'Notaire finalise'];

function activeStepFor(status) {
  if (status === 'AWAITING_VERIFICATION') return 1;
  if (status === 'AWAITING_NOTARY') return 2;
  if (status === 'COMPLETED') return 3;
  return 0;
}

const STATUS_STYLE = {
  COMPLETED: { bg: '#ecfdf5', color: '#059669' },
  REJECTED: { bg: '#fef2f2', color: '#dc2626' },
  DEFAULT: { bg: '#fff7ed', color: '#c2410c' },
};

function StepDots({ active, accent }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
      {STEPS.map((label, i) => {
        const done = i < active;
        const current = i === active;
        return (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{
                width: 22, height: 22, borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: done || current ? '#fff' : '#a3a8b8',
                bgcolor: done || current ? accent : '#eceef4',
              }}>
                {done ? '✓' : i + 1}
              </Box>
              <Typography sx={{ fontSize: 10.5, color: done || current ? '#171a2b' : '#a3a8b8', whiteSpace: 'nowrap' }}>{label}</Typography>
            </Box>
            {i < STEPS.length - 1 && <Box sx={{ flex: 1, height: 2, bgcolor: done ? accent : '#eceef4', mx: 1, mb: 2 }} />}
          </Box>
        );
      })}
    </Box>
  );
}

function PillButton({ onClick, disabled, color = '#4f46e5', children }) {
  return (
    <Box
      onClick={disabled ? undefined : onClick}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 1, px: 2.25, py: 1.3, borderRadius: '10px',
        bgcolor: color, color: '#fff', fontSize: 12.5, fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </Box>
  );
}

export default function TransferSign() {
  const { workflowId } = useParams();
  const { user } = useAuth();
  const theme = getRoleTheme(user?.role);
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkflow(await getWorkflowStatus(workflowId));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  if (!user) return <Alert severity="info">Veuillez vous connecter</Alert>;
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (error || !workflow) return <Alert severity="error">{error || 'Transfert introuvable'}</Alert>;
  if (workflow.workflow_type !== 'LAND_TRANSFER') {
    return <Alert severity="error">Ce workflow n'est pas un transfert de titre foncier.</Alert>;
  }

  const isNotary = workflow.notary_id === user.id;
  const isSeller = workflow.initiator_id === user.id;
  const canAccept = workflow.target_user_id === user.id && workflow.status === 'AWAITING_VERIFICATION';
  const canFinalize = isNotary && workflow.status === 'AWAITING_NOTARY';
  const statusStyle = STATUS_STYLE[workflow.status] || STATUS_STYLE.DEFAULT;

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await acceptTransfer({ workflow_id: workflow.workflow_id });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalize = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await finalizeTransfer({ workflow_id: workflow.workflow_id, notes });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mb: 2.5 }}>
        Vente du titre foncier #{workflow.document_token_id}
      </Typography>

      <StepDots active={activeStepFor(workflow.status)} accent={theme.accent} />

      <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75 }}>
        <Box sx={{
          display: 'inline-block', px: 1.4, py: 0.5, borderRadius: 999, fontSize: 11, fontWeight: 700, mb: 2,
          bgcolor: statusStyle.bg, color: statusStyle.color,
        }}>
          {workflow.status}
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {workflow.status === 'COMPLETED' && (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              ✅ Le transfert est finalisé — la propriété du titre a changé de mains.
            </Alert>
            <PillButton onClick={() => navigate(`/documents/${workflow.document_token_id}/history`)} color="#3b4054">
              Voir l'historique du document
            </PillButton>
          </>
        )}

        {workflow.status === 'REJECTED' && <Alert severity="error">Ce transfert a été refusé.</Alert>}

        {canAccept && (
          <>
            <Typography sx={{ fontSize: 13, color: '#3b4054', mb: 2 }}>
              Le vendeur vous propose ce titre. Signez pour accepter l'offre.
            </Typography>
            <PillButton onClick={handleAccept} disabled={submitting} color={theme.accent}>
              {submitting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Accepter et signer'}
            </PillButton>
          </>
        )}

        {canFinalize && (
          <>
            <Typography sx={{ fontSize: 13, color: '#3b4054', mb: 2 }}>
              Le vendeur et l'acheteur ont tous deux signé. Finalisez pour exécuter le transfert
              on-chain et régénérer le titre au nom du nouveau propriétaire.
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: '#5b6070', fontWeight: 500, mb: 0.75 }}>Notes (optionnel)</Typography>
            <Box
              component="textarea"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              sx={{
                width: '100%', boxSizing: 'border-box', p: '11px 13px', borderRadius: '9px', mb: 2,
                border: '1px solid #e7e9f2', bgcolor: '#fbfcfe', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
              }}
            />
            <PillButton onClick={handleFinalize} disabled={submitting} color={theme.accent}>
              {submitting ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : 'Finaliser le transfert'}
            </PillButton>
          </>
        )}

        {isSeller && workflow.status === 'AWAITING_VERIFICATION' && (
          <Typography sx={{ fontSize: 13, color: '#8a90a2' }}>
            Votre signature de vente est enregistrée. En attente de la signature de l'acheteur.
          </Typography>
        )}

        {!canAccept && !canFinalize && !isSeller && workflow.status !== 'COMPLETED' && workflow.status !== 'REJECTED' && (
          <Typography sx={{ fontSize: 13, color: '#8a90a2' }}>Aucune action requise de votre part pour le moment.</Typography>
        )}
      </Box>
    </Box>
  );
}
