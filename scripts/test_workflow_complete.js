// test_workflow_complete.js
// ============================================================
// TEST COMPLET DU WORKFLOW ALICE - TRUST PLATFORM
// ============================================================
// Installation : cd scripts && npm install
// Exécution    : node test_workflow_complete.js
// (API_URL peut être surchargée : API_URL=http://127.0.0.1:8000/api node test_workflow_complete.js)
// ============================================================

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Le backend n'est plus exposé directement (port 8010 fermé) : tout passe par Kong sur le
// port 8000, préfixe /api. 127.0.0.1 plutôt que "localhost" : sur Docker Desktop, la résolution
// IPv6 (::1) de "localhost" se traduit parfois par un "Connection reset".
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000/api';

class TrustWedgeTester {
  constructor() {
    this.tokens = {};
    this.dids = {};
    this.userIds = {};
    this.documents = {};
    this.workflows = {};
    this.api = axios.create({
      baseURL: API_URL,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ============================================================
  // UTILITAIRES
  // ============================================================

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[34m',
      success: '\x1b[32m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  async apiCall(method, url, data = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await this.api({
        method,
        url,
        data,
        headers
      });
      return response.data;
    } catch (error) {
      this.log(`❌ Erreur API ${url}: ${error.response?.data?.detail || error.message}`, 'error');
      throw error;
    }
  }

  // ============================================================
  // ÉTAPE 1 : ADMIN - CRÉATION DES ACTEURS
  // ============================================================

  async createActor(email, fullName, role, adminToken) {
    this.log(`👤 Création de ${fullName} (${role})...`, 'info');

    const response = await this.apiCall(
      'POST',
      '/admin/actors/create',
      { email, full_name: fullName, role },
      adminToken
    );

    this.dids[email] = response.did;
    this.userIds[email] = response.id;
    this.log(`   ✅ DID: ${response.did}`, 'success');
    this.log(`   🔑 Clé privée: ${response.private_key.substring(0, 20)}...`, 'warning');

    return response;
  }

  async login(email, password) {
    this.log(`🔐 Connexion de ${email}...`, 'info');

    const response = await this.apiCall(
      'POST',
      '/auth/login',
      { email, password }
    );

    this.tokens[email] = response.access_token;
    this.log(`   ✅ Token récupéré`, 'success');

    return response;
  }

  // ============================================================
  // ÉTAPE 2 : UNIVERSITÉ - ÉMISSION DU DIPLÔME
  // ============================================================

  async issueDiploma(universityToken, ownerDid, studentName) {
    this.log(`🎓 Université émet le diplôme pour ${studentName}...`, 'info');

    const response = await this.apiCall(
      'POST',
      '/documents/issue',
      {
        owner_did: ownerDid,
        doc_type: 'DIPLOMA',
        doc_key: `DIP-${Date.now()}`,
        attributes: [
          { key: 'studentName', value: studentName, valueType: 'string' },
          { key: 'fieldOfStudy', value: 'Computer Science', valueType: 'string' },
          { key: 'graduationDate', value: '2024-06-15', valueType: 'string' },
          { key: 'grade', value: 'A', valueType: 'string' }
        ],
        file_content: Buffer.from('Test Diploma Content').toString('base64'),
        filename: 'diploma.pdf',
        is_transferable: false
      },
      universityToken
    );

    // Le backend renvoie "token_id" (snake_case), pas "tokenId".
    this.documents['diploma'] = response.token_id;
    this.log(`   ✅ Diplôme émis: Token #${response.token_id}`, 'success');

    return response;
  }

  // ============================================================
  // ÉTAPE 3 : ENTREPRISE - VÉRIFICATION DU DIPLÔME
  // ============================================================

  async verifyDiploma(companyToken, tokenId) {
    this.log(`🔍 Entreprise vérifie le diplôme #${tokenId}...`, 'info');

    const response = await this.apiCall(
      'GET',
      `/documents/verify/${tokenId}`,
      null,
      companyToken
    );

    this.log(`   ✅ Statut: ${response.isValid ? 'Valide' : 'Invalide'}`,
             response.isValid ? 'success' : 'error');
    this.log(`   📌 Émetteur: ${response.issuer}`, 'info');
    this.log(`   👤 Propriétaire: ${response.owner}`, 'info');

    return response;
  }

  // ============================================================
  // ÉTAPE 4 : ENTREPRISE - ÉMISSION DE L'ATTESTATION D'EMPLOI
  // ============================================================

  async issueEmployment(companyToken, ownerDid, position) {
    this.log(`💼 Entreprise émet l'attestation d'emploi...`, 'info');

    const response = await this.apiCall(
      'POST',
      '/documents/issue',
      {
        owner_did: ownerDid,
        doc_type: 'EMPLOYMENT',
        doc_key: `EMP-${Date.now()}`,
        attributes: [
          { key: 'position', value: position, valueType: 'string' },
          { key: 'startDate', value: '2024-07-01', valueType: 'string' },
          { key: 'salary', value: '60000', valueType: 'uint256' }
        ],
        file_content: Buffer.from('Test Employment Content').toString('base64'),
        filename: 'employment.pdf',
        is_transferable: false
      },
      companyToken
    );

    this.documents['employment'] = response.token_id;
    this.log(`   ✅ Attestation émise: Token #${response.token_id}`, 'success');

    return response;
  }

  // ============================================================
  // ÉTAPE 5 : ALICE - DEMANDE DE PRÊT À LA BANQUE
  // ============================================================

  async requestLoan(aliceToken, bankId, employmentTokenId) {
    this.log(`🏦 Alice demande un prêt à la Banque...`, 'info');

    const workflow = await this.apiCall(
      'POST',
      '/workflows/create',
      {
        workflow_type: 'LOAN_APPLICATION',
        target_user_id: bankId,
        document_token_id: employmentTokenId,
        workflow_data: {
          amount: 10000000,
          purpose: 'Achat immobilier'
        }
      },
      aliceToken
    );

    this.workflows['loan'] = workflow.workflow_id;
    this.log(`   ✅ Workflow de prêt créé: #${workflow.workflow_id}`, 'success');

    await this.apiCall(
      'POST',
      `/workflows/${workflow.workflow_id}/start`,
      null,
      aliceToken
    );
    this.log(`   ✅ Workflow démarré`, 'success');

    await this.apiCall(
      'POST',
      `/workflows/${workflow.workflow_id}/request-verification`,
      {
        verifier_id: bankId,
        verification_data: { purpose: 'Demande de prêt immobilier' }
      },
      aliceToken
    );
    this.log(`   ✅ Vérification demandée à la Banque`, 'success');

    return workflow;
  }

  // ============================================================
  // ÉTAPE 6 : BANQUE - VÉRIFICATION ET ACCORD DU PRÊT
  // ============================================================

  async approveLoan(bankToken, workflowId, employmentTokenId) {
    this.log(`🏦 Banque: Vérification de l'attestation d'emploi...`, 'info');

    const doc = await this.apiCall(
      'GET',
      `/documents/verify/${employmentTokenId}`,
      null,
      bankToken
    );

    if (!doc.isValid) {
      this.log(`   ❌ Attestation invalide!`, 'error');
      return false;
    }
    this.log(`   ✅ Attestation d'emploi valide`, 'success');

    await this.apiCall(
      'POST',
      `/workflows/${workflowId}/submit-verification`,
      {
        is_valid: true,
        notes: 'Attestation vérifiée, prêt accordé'
      },
      bankToken
    );

    this.log(`   ✅ Prêt accordé!`, 'success');
    return true;
  }

  // ============================================================
  // ÉTAPE 7 : ADMIN - ÉMISSION DU TITRE FONCIER POUR LE PROPRIÉTAIRE
  // ============================================================

  async issueLandTitle(adminToken, ownerDid, location, area) {
    this.log(`🏠 Admin émet le titre foncier pour le propriétaire...`, 'info');

    const response = await this.apiCall(
      'POST',
      '/documents/issue',
      {
        owner_did: ownerDid,
        doc_type: 'LAND_TITLE',
        doc_key: `TF-${Date.now()}`,
        attributes: [
          { key: 'location', value: location, valueType: 'string' },
          { key: 'landArea', value: area, valueType: 'uint256' },
          { key: 'value', value: '50000000', valueType: 'uint256' }
        ],
        file_content: Buffer.from('Test Land Title Content').toString('base64'),
        filename: 'land_title.pdf',
        is_transferable: true
      },
      adminToken
    );

    this.documents['land_title'] = response.token_id;
    this.log(`   ✅ Titre foncier émis: Token #${response.token_id}`, 'success');
    this.log(`   👤 Propriétaire: ${ownerDid}`, 'info');

    return response;
  }

  // ============================================================
  // ÉTAPE 8 : ALICE - VÉRIFICATION DU TITRE
  // ============================================================

  async verifyLandTitle(aliceToken, landTokenId) {
    this.log(`🔍 Alice vérifie le titre foncier #${landTokenId}...`, 'info');

    const result = await this.apiCall(
      'GET',
      `/documents/verify/${landTokenId}`,
      null,
      aliceToken
    );

    this.log(`   ✅ Titre ${result.isValid ? 'valide' : 'invalide'}`,
             result.isValid ? 'success' : 'error');
    this.log(`   📌 Émetteur: ${result.issuer}`, 'info');
    this.log(`   👤 Propriétaire: ${result.owner}`, 'info');

    return result;
  }

  // ============================================================
  // ÉTAPE 9 : ALICE - DEMANDE DE TRANSFERT DE PROPRIÉTÉ
  // ============================================================

  async requestLandTransfer(aliceToken, notaryId, landTokenId) {
    this.log(`🏠 Alice demande le transfert de propriété...`, 'info');

    const workflow = await this.apiCall(
      'POST',
      '/workflows/create',
      {
        workflow_type: 'LAND_TRANSFER',
        target_user_id: notaryId,
        document_token_id: landTokenId,
        workflow_data: {
          property_value: 50000000,
          location: 'Dakar, Sénégal',
          seller: 'Propriétaire'
        }
      },
      aliceToken
    );

    this.workflows['land_transfer'] = workflow.workflow_id;
    this.log(`   ✅ Workflow de transfert créé: #${workflow.workflow_id}`, 'success');

    await this.apiCall(
      'POST',
      `/workflows/${workflow.workflow_id}/start`,
      null,
      aliceToken
    );
    this.log(`   ✅ Workflow démarré`, 'success');

    await this.apiCall(
      'POST',
      `/workflows/${workflow.workflow_id}/request-verification`,
      {
        verifier_id: notaryId,
        verification_data: { purpose: 'Vérification du titre de propriété' }
      },
      aliceToken
    );
    this.log(`   ✅ Vérification demandée au notaire`, 'success');

    return workflow;
  }

  // ============================================================
  // ÉTAPE 10 : NOTAIRE - VÉRIFICATION DU TITRE
  // ============================================================

  async notaryVerifyTitle(notaryToken, workflowId, landTokenId) {
    this.log(`🏛️ Notaire: Vérification du titre foncier...`, 'info');

    const doc = await this.apiCall(
      'GET',
      `/documents/verify/${landTokenId}`,
      null,
      notaryToken
    );

    if (!doc.isValid) {
      this.log(`   ❌ Titre invalide!`, 'error');
      return false;
    }
    this.log(`   ✅ Titre authentifié, sans litige`, 'success');

    await this.apiCall(
      'POST',
      `/workflows/${workflowId}/submit-verification`,
      {
        is_valid: true,
        notes: 'Titre authentifié, sans litige'
      },
      notaryToken
    );

    this.log(`   ✅ Vérification soumise`, 'success');
    return true;
  }

  // ============================================================
  // ÉTAPE 11 : ALICE - DEMANDE DE VALIDATION NOTARIALE
  // ============================================================

  async requestNotaryValidation(aliceToken, workflowId, notaryId) {
    this.log(`🏛️ Alice demande la validation notariale...`, 'info');

    const result = await this.apiCall(
      'POST',
      `/workflows/${workflowId}/request-notary`,
      { notary_id: notaryId },
      aliceToken
    );

    this.log(`   ✅ Validation notariale demandée`, 'success');
    return result;
  }

  // ============================================================
  // ÉTAPE 12 : NOTAIRE - VALIDATION FINALE
  // ============================================================

  async notaryFinalValidation(notaryToken, workflowId) {
    this.log(`🏛️ Notaire: Validation finale du transfert...`, 'info');

    const result = await this.apiCall(
      'POST',
      `/workflows/${workflowId}/validate-by-notary`,
      {
        is_valid: true,
        notes: 'Vente validée, titre transféré',
        transaction_hash: `0x${uuidv4().replace(/-/g, '')}`
      },
      notaryToken
    );

    this.log(`   ✅ Transfert finalisé!`, 'success');
    return result;
  }

  // ============================================================
  // RUN - EXÉCUTION COMPLÈTE
  // ============================================================

  async run() {
    this.log('\n' + '='.repeat(60), 'info');
    this.log('🧪 TRUST PLATFORM - TEST COMPLET DU WORKFLOW ALICE', 'info');
    this.log('='.repeat(60) + '\n', 'info');

    try {
      // ============================================================
      // PHASE 1 : ADMIN - CRÉATION DES ACTEURS
      // ============================================================
      this.log('\n📌 PHASE 1: CRÉATION DES ACTEURS', 'info');
      this.log('-'.repeat(40), 'info');

      // Admin (doit déjà exister — voir README, section "Comptes de test")
      await this.login('admin@trustwedge.com', 'admin123');
      const adminToken = this.tokens['admin@trustwedge.com'];

      // Suffixe unique pour ne pas entrer en collision avec des comptes déjà créés.
      const runId = Date.now();
      const email = (prefix) => `${prefix}+${runId}@test.com`;

      const universityEmail = email('university');
      const aliceEmail = email('alice');
      const companyEmail = email('company');
      const bankEmail = email('bank');
      const notaryEmail = email('notary');
      const ownerEmail = email('owner');

      // Création des acteurs (y compris le Propriétaire)
      await this.createActor(universityEmail, 'Université de Dakar', 'ISSUER', adminToken);
      await this.createActor(aliceEmail, 'Alice Diop', 'USER', adminToken);
      await this.createActor(companyEmail, 'Tech Corp Sénégal', 'VERIFIER', adminToken);
      await this.createActor(bankEmail, 'Banque Nationale', 'VERIFIER', adminToken);
      await this.createActor(notaryEmail, 'Notaire de Dakar', 'NOTARY', adminToken);
      await this.createActor(ownerEmail, 'Jean Ndiaye (Propriétaire)', 'USER', adminToken);

      // Connexion de tous les acteurs (mot de passe ignoré par le MVP, voir README)
      await this.login(universityEmail, 'password123');
      await this.login(aliceEmail, 'password123');
      await this.login(companyEmail, 'password123');
      await this.login(bankEmail, 'password123');
      await this.login(notaryEmail, 'password123');
      await this.login(ownerEmail, 'password123');

      // ============================================================
      // PHASE 2 : UNIVERSITÉ - ÉMISSION DU DIPLÔME
      // ============================================================
      this.log('\n📌 PHASE 2: ÉMISSION DU DIPLÔME', 'info');
      this.log('-'.repeat(40), 'info');

      const univToken = this.tokens[universityEmail];
      const aliceDid = this.dids[aliceEmail];
      await this.issueDiploma(univToken, aliceDid, 'Alice Diop');

      // ============================================================
      // PHASE 3 : ENTREPRISE - VÉRIFICATION DU DIPLÔME
      // ============================================================
      this.log('\n📌 PHASE 3: VÉRIFICATION DU DIPLÔME', 'info');
      this.log('-'.repeat(40), 'info');

      const companyToken = this.tokens[companyEmail];
      const diplomaToken = this.documents['diploma'];
      await this.verifyDiploma(companyToken, diplomaToken);

      // ============================================================
      // PHASE 4 : ENTREPRISE - ATTESTATION D'EMPLOI
      // ============================================================
      this.log('\n📌 PHASE 4: ATTESTATION D\'EMPLOI', 'info');
      this.log('-'.repeat(40), 'info');

      await this.issueEmployment(companyToken, aliceDid, 'Software Engineer');

      // ============================================================
      // PHASE 5 : ALICE - DEMANDE DE PRÊT
      // ============================================================
      this.log('\n📌 PHASE 5: DEMANDE DE PRÊT', 'info');
      this.log('-'.repeat(40), 'info');

      const aliceToken = this.tokens[aliceEmail];
      const bankId = this.userIds[bankEmail];
      const employmentToken = this.documents['employment'];
      await this.requestLoan(aliceToken, bankId, employmentToken);

      // ============================================================
      // PHASE 6 : BANQUE - ACCORD DU PRÊT
      // ============================================================
      this.log('\n📌 PHASE 6: ACCORD DU PRÊT', 'info');
      this.log('-'.repeat(40), 'info');

      const bankToken = this.tokens[bankEmail];
      const loanWorkflowId = this.workflows['loan'];
      await this.approveLoan(bankToken, loanWorkflowId, employmentToken);

      // ============================================================
      // PHASE 7 : ADMIN - TITRE FONCIER POUR LE PROPRIÉTAIRE
      // ============================================================
      this.log('\n📌 PHASE 7: TITRE FONCIER POUR LE PROPRIÉTAIRE', 'info');
      this.log('-'.repeat(40), 'info');

      const ownerDid = this.dids[ownerEmail];
      await this.issueLandTitle(adminToken, ownerDid, 'Dakar, Sénégal', '500');

      // ============================================================
      // PHASE 8 : ALICE - VÉRIFICATION DU TITRE
      // ============================================================
      this.log('\n📌 PHASE 8: VÉRIFICATION DU TITRE', 'info');
      this.log('-'.repeat(40), 'info');

      const landToken = this.documents['land_title'];
      await this.verifyLandTitle(aliceToken, landToken);

      // ============================================================
      // PHASE 9 : ALICE - DEMANDE DE TRANSFERT
      // ============================================================
      this.log('\n📌 PHASE 9: DEMANDE DE TRANSFERT', 'info');
      this.log('-'.repeat(40), 'info');

      const notaryId = this.userIds[notaryEmail];
      await this.requestLandTransfer(aliceToken, notaryId, landToken);

      // ============================================================
      // PHASE 10 : NOTAIRE - VÉRIFICATION
      // ============================================================
      this.log('\n📌 PHASE 10: VÉRIFICATION NOTAIRE', 'info');
      this.log('-'.repeat(40), 'info');

      const notaryToken = this.tokens[notaryEmail];
      const landWorkflowId = this.workflows['land_transfer'];
      await this.notaryVerifyTitle(notaryToken, landWorkflowId, landToken);

      // ============================================================
      // PHASE 11 : ALICE - DEMANDE VALIDATION NOTARIALE
      // ============================================================
      this.log('\n📌 PHASE 11: DEMANDE VALIDATION NOTARIALE', 'info');
      this.log('-'.repeat(40), 'info');

      await this.requestNotaryValidation(aliceToken, landWorkflowId, notaryId);

      // ============================================================
      // PHASE 12 : NOTAIRE - VALIDATION FINALE
      // ============================================================
      this.log('\n📌 PHASE 12: VALIDATION FINALE', 'info');
      this.log('-'.repeat(40), 'info');

      await this.notaryFinalValidation(notaryToken, landWorkflowId);

      // ============================================================
      // RÉSULTAT FINAL
      // ============================================================
      this.log('\n' + '='.repeat(60), 'success');
      this.log('🎉 TEST TERMINÉ AVEC SUCCÈS !', 'success');
      this.log('='.repeat(60) + '\n', 'success');

      this.log('📊 RÉCAPITULATIF:', 'info');
      this.log(`   🎓 Diplôme: Token #${this.documents['diploma']}`, 'info');
      this.log(`   💼 Attestation: Token #${this.documents['employment']}`, 'info');
      this.log(`   🏠 Titre foncier: Token #${this.documents['land_title']}`, 'info');
      this.log(`   👤 Propriétaire du titre: ${this.dids[ownerEmail]}`, 'info');
      this.log(`   🏦 Prêt: Workflow #${this.workflows['loan']} (IN_PROGRESS après accord)`, 'info');
      this.log(`   🏛️ Transfert: Workflow #${this.workflows['land_transfer']} (COMPLETED)`, 'info');
      this.log('');

    } catch (error) {
      this.log(`\n❌ TEST ÉCHOUÉ: ${error.message}`, 'error');
      throw error;
    }
  }
}

// ============================================================
// EXÉCUTION
// ============================================================

const tester = new TrustWedgeTester();
tester.run().then(() => {
  console.log('\n✅ Test terminé avec succès!');
}).catch((error) => {
  console.error('\n❌ Erreur:', error.message);
  process.exit(1);
});
