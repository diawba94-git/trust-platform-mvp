import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  Select,
  MenuItem,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  IconButton,
  Chip,
  Tooltip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import IssueDocumentForm from '../../components/IssueDocumentForm';
import { getUsers, ocrExtractLandTitle, importLandTitle } from '../../services/api';
import { getRoleTheme } from '../../theme/roleThemes';

const ACCENT = getRoleTheme('ADMIN').accent;

const LAND_TITLE_FIELDS = [
  { key: 'landArea', label: 'Superficie (m²)', valueType: 'uint256' },
  { key: 'location', label: 'Localisation', valueType: 'string' },
  { key: 'value', label: 'Valeur estimée (FCFA)', valueType: 'uint256' },
];

let rowIdCounter = 0;
const nextRowId = () => (rowIdCounter += 1);

const STATUS_CHIP = {
  analyzing: { label: 'Analyse OCR…', color: 'default' },
  ready: { label: 'À vérifier', color: 'warning' },
  importing: { label: 'Import…', color: 'info' },
  success: { label: 'Importé', color: 'success' },
  error: { label: 'Échec', color: 'error' },
};

// Import par lot : chaque fichier est lu par OCR (Tesseract) pour pré-remplir ses champs,
// puis l'admin vérifie/corrige chaque ligne avant de valider l'import — l'OCR n'est qu'une
// suggestion, aucune donnée n'est enregistrée avant validation explicite.
function ImportTab() {
  const [owners, setOwners] = useState([]);
  const [rows, setRows] = useState([]);
  const [validating, setValidating] = useState(false);
  const [summary, setSummary] = useState(null);

  React.useEffect(() => {
    getUsers('USER').then(setOwners).catch(() => setOwners([]));
  }, []);

  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleFilesSelected = (fileList) => {
    setSummary(null);
    const files = Array.from(fileList || []);
    const newRows = files.map((file) => ({
      id: nextRowId(),
      file,
      filename: file.name,
      status: 'analyzing',
      docKey: '',
      location: '',
      landArea: '',
      value: '',
      ownerEmail: '',
      errorMsg: null,
      tokenId: null,
    }));
    setRows((prev) => [...prev, ...newRows]);

    newRows.forEach(async (row) => {
      try {
        const extracted = await ocrExtractLandTitle(row.file);
        updateRow(row.id, {
          status: 'ready',
          docKey: extracted.doc_key || '',
          location: extracted.location || '',
          landArea: extracted.land_area || '',
          value: extracted.value || '',
        });
      } catch (err) {
        // L'OCR a échoué (fichier illisible, etc.) : la ligne reste éditable, l'admin
        // renseigne les champs manuellement.
        updateRow(row.id, { status: 'ready' });
      }
    });
  };

  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const canValidate =
    rows.length > 0 &&
    !validating &&
    rows.every((r) => r.status === 'ready' && r.ownerEmail && r.docKey && r.location && r.landArea && r.value);

  const handleValidateImport = async () => {
    setValidating(true);
    setSummary(null);
    let successCount = 0;
    let errorCount = 0;

    // Séquentiel (pas en parallèle) : chaque émission signe avec la même clé plateforme,
    // des envois concurrents provoqueraient des collisions de nonce on-chain.
    for (const row of rows) {
      updateRow(row.id, { status: 'importing' });
      try {
        const response = await importLandTitle({
          ownerEmail: row.ownerEmail,
          docKey: row.docKey,
          location: row.location,
          landArea: row.landArea,
          value: row.value,
          isTransferable: true,
          file: row.file,
        });
        updateRow(row.id, { status: 'success', tokenId: response.token_id, errorMsg: null });
        successCount += 1;
      } catch (err) {
        updateRow(row.id, { status: 'error', errorMsg: err.message });
        errorCount += 1;
      }
    }

    setSummary({ successCount, errorCount, total: rows.length });
    setValidating(false);
  };

  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #eceef4', borderRadius: '14px', p: 2.75 }}>
      <Typography sx={{ fontSize: 13, color: '#8a90a2', mb: 2 }}>
        Digitalisez un ou plusieurs titres fonciers déjà délivrés. Chaque fichier est lu par
        OCR pour pré-remplir ses informations — vérifiez et corrigez chaque ligne avant de
        valider l'import.
      </Typography>

      <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ mb: 2, borderRadius: '9px', textTransform: 'none' }}>
        Ajouter des fichiers
        <input
          type="file"
          hidden
          multiple
          accept="application/pdf,image/*"
          onChange={(e) => {
            handleFilesSelected(e.target.files);
            e.target.value = '';
          }}
        />
      </Button>

      {rows.length > 0 && (
        <>
          <TableContainer sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fichier</TableCell>
                  <TableCell>Référence</TableCell>
                  <TableCell>Localisation</TableCell>
                  <TableCell>Superficie (m²)</TableCell>
                  <TableCell>Valeur (FCFA)</TableCell>
                  <TableCell>Propriétaire</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const locked = row.status === 'importing' || row.status === 'success';
                  return (
                    <React.Fragment key={row.id}>
                    <TableRow>
                      <TableCell sx={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <Tooltip title={row.filename}>
                          <span>{row.filename}</span>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        {row.status === 'analyzing' ? (
                          <CircularProgress size={16} />
                        ) : (
                          <TextField
                            size="small"
                            variant="standard"
                            value={row.docKey}
                            onChange={(e) => updateRow(row.id, { docKey: e.target.value })}
                            disabled={locked}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.status !== 'analyzing' && (
                          <TextField
                            size="small"
                            variant="standard"
                            value={row.location}
                            onChange={(e) => updateRow(row.id, { location: e.target.value })}
                            disabled={locked}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.status !== 'analyzing' && (
                          <TextField
                            size="small"
                            variant="standard"
                            type="number"
                            value={row.landArea}
                            onChange={(e) => updateRow(row.id, { landArea: e.target.value })}
                            disabled={locked}
                            sx={{ width: 90 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.status !== 'analyzing' && (
                          <TextField
                            size="small"
                            variant="standard"
                            type="number"
                            value={row.value}
                            onChange={(e) => updateRow(row.id, { value: e.target.value })}
                            disabled={locked}
                            sx={{ width: 110 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {row.status !== 'analyzing' && (
                          <FormControl size="small" variant="standard" sx={{ minWidth: 140 }}>
                            <Select
                              displayEmpty
                              value={row.ownerEmail}
                              onChange={(e) => updateRow(row.id, { ownerEmail: e.target.value })}
                              disabled={locked}
                            >
                              <MenuItem value=""><em>Choisir…</em></MenuItem>
                              {owners.map((u) => (
                                <MenuItem key={u.id} value={u.email}>{u.full_name}</MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          icon={row.status === 'ready' ? <AutoFixHighIcon sx={{ fontSize: 14 }} /> : undefined}
                          label={row.status === 'success' && row.tokenId != null
                            ? `Token #${row.tokenId}`
                            : STATUS_CHIP[row.status].label}
                          color={STATUS_CHIP[row.status].color}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => removeRow(row.id)} disabled={row.status === 'importing'}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                    {row.status === 'error' && row.errorMsg && (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ py: 0.5, border: 0 }}>
                          <Alert severity="error" sx={{ py: 0 }}>{row.errorMsg}</Alert>
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>

          <Box
            onClick={!canValidate ? undefined : handleValidateImport}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, px: 2.25, py: 1.3,
              borderRadius: '10px', bgcolor: ACCENT, color: '#fff', fontSize: 12.5, fontWeight: 500,
              cursor: !canValidate ? 'not-allowed' : 'pointer', opacity: !canValidate ? 0.5 : 1,
            }}
          >
            {validating ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : `Valider l'import (${rows.length} fichier${rows.length > 1 ? 's' : ''})`}
          </Box>
        </>
      )}

      {summary && (
        <Alert severity={summary.errorCount === 0 ? 'success' : 'warning'} sx={{ mt: 2 }}>
          {summary.successCount}/{summary.total} titre(s) importé(s) avec succès
          {summary.errorCount > 0 && ` — ${summary.errorCount} échec(s), voir le détail par ligne`}.
        </Alert>
      )}
    </Box>
  );
}

export default function IssueLandTitle() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ maxWidth: 1100 }}>
      <Typography sx={{ fontSize: 11, color: '#a3a8b8', letterSpacing: '0.04em' }}>Titres & documents</Typography>
      <Typography sx={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.015em', mt: 0.5 }}>
        Émission de titres fonciers
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#8a90a2', mt: 0.75, mb: 2.5 }}>
        Émettez un NOUVEAU titre foncier au nom d'un citoyen — par saisie manuelle ou en
        important un ou plusieurs fichiers existants. Un titre déjà émis ne peut être ni
        modifié ni transféré depuis cet espace : seul le mécanisme de vente entre
        particuliers (triple signature) permet de changer son propriétaire.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2.5 }}>
        {['Saisie manuelle', 'Importer des fichiers'].map((label, i) => (
          <Box
            key={label}
            onClick={() => setTab(i)}
            sx={{
              px: 2, py: 1, borderRadius: '9px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
              bgcolor: tab === i ? ACCENT : '#fff', color: tab === i ? '#fff' : '#3b4054',
              border: `1px solid ${tab === i ? ACCENT : '#e7e9f2'}`,
            }}
          >
            {label}
          </Box>
        ))}
      </Box>

      {tab === 0 && (
        <IssueDocumentForm
          docType="LAND_TITLE"
          title="Nouveau titre foncier"
          attributeFields={LAND_TITLE_FIELDS}
          recipientRole="USER"
        />
      )}
      {tab === 1 && <ImportTab />}
    </Box>
  );
}
