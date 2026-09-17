// test_land_title_tampering.js
// ============================================================
// TEST DE FALSIFICATION D'UN TITRE FONCIER — TRUST PLATFORM
// ============================================================
// Émet un titre foncier réel, puis vérifie que le registre détecte bien toute
// falsification du certificat PDF (même un seul octet modifié) :
//   1. Le fichier ORIGINAL est reconnu comme authentique (avec et sans Token ID fourni).
//   2. Le fichier FALSIFIÉ est rejeté par la vérification ciblée (Token ID + fichier).
//   3. Le fichier FALSIFIÉ n'est reconnu par aucun document lors de la vérification
//      automatique (sans Token ID) — son empreinte ne correspond à rien de connu.
//
// Installation : cd scripts && npm install
// Exécution    : node test_land_title_tampering.js
// (API_URL peut être surchargée : API_URL=http://127.0.0.1:8000/api node test_land_title_tampering.js)
// ============================================================

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://127.0.0.1:8000/api';

const COLORS = { info: '\x1b[34m', success: '\x1b[32m', error: '\x1b[31m', warning: '\x1b[33m', reset: '\x1b[0m' };
function log(message, type = 'info') {
  console.log(`${COLORS[type]}${message}${COLORS.reset}`);
}

const api = axios.create({ baseURL: API_URL });

async function apiCall(method, url, data, token, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const response = await api({ method, url, data, headers });
    return response.data;
  } catch (error) {
    const detail = error.response?.data?.detail;
    const detailStr = typeof detail === 'string' ? detail : detail ? JSON.stringify(detail) : error.message;
    throw new Error(`${method} ${url} -> ${detailStr}`);
  }
}

async function login(email, password) {
  const res = await apiCall('POST', '/auth/login', { email, password });
  return res.access_token;
}

async function createActor(email, fullName, role, adminToken) {
  const payload = { email, full_name: fullName, role };
  if (role === 'USER') {
    Object.assign(payload, {
      date_of_birth: '1990-01-01',
      place_of_birth: 'Dakar',
      national_id_number: `TAMPER-${Date.now()}`,
    });
  }
  return apiCall('POST', '/admin/actors/create', payload, adminToken);
}

async function issueLandTitle(adminToken, ownerDid) {
  return apiCall(
    'POST',
    '/documents/issue',
    {
      owner_did: ownerDid,
      doc_type: 'LAND_TITLE',
      doc_key: `TF-TAMPER-TEST-${Date.now()}`,
      attributes: [
        { key: 'location', value: 'Thiès, Sénégal', valueType: 'string' },
        { key: 'landArea', value: '750', valueType: 'uint256' },
        { key: 'value', value: '35000000', valueType: 'uint256' },
      ],
      file_content: 'placeholder',
      filename: 'titre_test.pdf',
      is_transferable: true,
    },
    adminToken
  );
}

async function downloadPdf(cid, token) {
  const res = await api.get(`/documents/download/${cid}`, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer',
  });
  return Buffer.from(res.data);
}

// Falsifie un PDF en modifiant un seul octet au milieu du fichier — suffisant pour changer
// entièrement son empreinte IPFS (adressage par contenu), donc pour être détecté par le
// registre, même si le fichier reste par ailleurs un PDF valide et visuellement quasi identique.
function tamperPdf(original) {
  const tampered = Buffer.from(original);
  const offset = Math.floor(tampered.length / 2);
  tampered[offset] = tampered[offset] ^ 0xff;
  return tampered;
}

async function verifyFileWithToken(tokenId, fileBuffer, filename, token) {
  const form = new FormData();
  form.append('file', new Blob([fileBuffer]), filename);
  return apiCall('POST', `/documents/${tokenId}/verify-file`, form, token);
}

async function verifyFileAuto(fileBuffer, filename, token) {
  const form = new FormData();
  form.append('file', new Blob([fileBuffer]), filename);
  return apiCall('POST', '/documents/verify-file', form, token);
}

const results = [];
function check(label, passed, detail) {
  results.push({ label, passed, detail });
  log(`   ${passed ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`, passed ? 'success' : 'error');
}

async function run() {
  log('\n' + '='.repeat(60), 'info');
  log('🧪 TEST DE FALSIFICATION — TITRE FONCIER', 'info');
  log('='.repeat(60) + '\n', 'info');

  log('📌 PHASE 1 : ÉMISSION D\'UN TITRE FONCIER DE TEST', 'info');
  log('-'.repeat(40), 'info');

  const adminToken = await login('admin@trustwedge.com', 'admin123');
  const runId = Date.now();
  const ownerEmail = `owner-tamper-test+${runId}@test.com`;
  const owner = await createActor(ownerEmail, 'Propriétaire Test Falsification', 'USER', adminToken);
  log(`   ✅ Propriétaire créé : ${owner.did}`, 'success');

  const doc = await issueLandTitle(adminToken, owner.did);
  const tokenId = doc.token_id;
  log(`   ✅ Titre foncier émis : Token #${tokenId} (CID on-chain : ${doc.ipfs_cid})`, 'success');

  log('\n📌 PHASE 2 : RÉCUPÉRATION DU CERTIFICAT PDF RÉEL', 'info');
  log('-'.repeat(40), 'info');

  const originalPdf = await downloadPdf(doc.ipfs_cid, adminToken);
  const tamperedPdf = tamperPdf(originalPdf);
  log(`   ✅ Certificat téléchargé (${originalPdf.length} octets)`, 'success');
  log(`   ✏️  Copie falsifiée générée (1 octet modifié, taille inchangée)`, 'warning');

  log('\n📌 PHASE 3 : VÉRIFICATIONS', 'info');
  log('-'.repeat(40), 'info');

  // 1) Fichier original + Token ID connu -> doit correspondre
  const r1 = await verifyFileWithToken(tokenId, originalPdf, 'titre_test.pdf', adminToken);
  check('Fichier ORIGINAL + Token ID -> reconnu comme authentique', r1.match === true);

  // 2) Fichier original SANS Token ID -> doit être retrouvé automatiquement
  const r2 = await verifyFileAuto(originalPdf, 'titre_test.pdf', adminToken);
  check(
    'Fichier ORIGINAL sans Token ID -> retrouvé automatiquement',
    r2.token_id === tokenId && r2.match === true,
    `token_id détecté = ${r2.token_id}`
  );

  // 3) Fichier FALSIFIÉ + Token ID connu -> doit être rejeté (mismatch explicite)
  const r3 = await verifyFileWithToken(tokenId, tamperedPdf, 'titre_test.pdf', adminToken);
  check('Fichier FALSIFIÉ + Token ID -> détecté comme non conforme', r3.match === false);

  // 4) Fichier FALSIFIÉ SANS Token ID -> ne doit correspondre à aucun document connu
  let r4Rejected = false;
  let r4Detail = '';
  try {
    await verifyFileAuto(tamperedPdf, 'titre_test.pdf', adminToken);
  } catch (err) {
    r4Rejected = /aucun document connu/i.test(err.message);
    r4Detail = err.message;
  }
  check('Fichier FALSIFIÉ sans Token ID -> aucun document reconnu', r4Rejected, r4Detail);

  log('\n' + '='.repeat(60), 'info');
  const allPassed = results.every((r) => r.passed);
  if (allPassed) {
    log('🎉 TEST TERMINÉ : LE REGISTRE DÉTECTE BIEN LA FALSIFICATION', 'success');
  } else {
    log('❌ TEST ÉCHOUÉ : au moins une vérification n\'a pas le résultat attendu', 'error');
  }
  log('='.repeat(60) + '\n', 'info');

  if (!allPassed) process.exit(1);
}

run().catch((error) => {
  log(`\n❌ Erreur: ${error.message}`, 'error');
  process.exit(1);
});
