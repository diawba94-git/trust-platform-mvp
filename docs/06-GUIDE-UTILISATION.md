# TrustWedge — Guide d'utilisation de la solution

> Document 6/6 de la documentation projet. Voir [docs/README.md](README.md) pour l'index complet.
> Pour un pas-à-pas illustré du parcours complet d'Alice, voir [ParcoursAlice.html](ParcoursAlice.html). Ce guide couvre en plus **chaque tableau de bord par rôle** et le **wallet mobile**.

## 1. Prise en main

### 1.1 Lancer la plateforme

Voir le [README](../README.md) (§ Lancement, § Tester l'application) pour les commandes de démarrage complètes. Résumé :

1. `scripts\generate-network.bat` (une seule fois) — génère le réseau blockchain.
2. `docker compose up -d --build` — démarre les 11 conteneurs.
3. Déployer le contrat (Hardhat), redémarrer le backend avec l'adresse du contrat.
4. Ouvrir `http://localhost:8000`.

### 1.2 Se connecter

Page de connexion : `http://localhost:8000/login`. En mode démo, **n'importe quel mot de passe fonctionne** une fois l'email enregistré (le MVP ne vérifie pas le mot de passe — voir [01-SPECIFICATIONS.md](01-SPECIFICATIONS.md) §7). Comptes de test :

| Email | Rôle | Tableau de bord |
|---|---|---|
| `university@trustwedge.com` | ISSUER | `/university` |
| `alice@trustwedge.com` | USER | `/alice` |
| `company@trustwedge.com` | VERIFIER | `/company` |
| `bank@trustwedge.com` | VERIFIER (banque) | `/bank` |
| `notary@trustwedge.com` | NOTARY | `/state` |

Mot de passe de convention pour la démo : `test1234`.

## 2. Guide par rôle

### 2.1 Université (`/university` — Issuer)

Écran principal : `IssuerHome`. Fonctions :
- **Émettre un document** (`IssueDocumentForm`) : sélectionner l'étudiant (parmi les comptes que l'université a elle-même créés — restriction volontaire, une université ne peut émettre qu'à ses propres étudiants), renseigner le type de document, la référence unique, les attributs (mention, filière, année...), joindre un fichier. Le PDF final est généré automatiquement par la plateforme à partir des attributs saisis.
- **Consulter les documents émis** (`GET /documents/issued`).
- **Suivre les workflows** où l'université est initiatrice ou vérificatrice.
- **Créer des comptes étudiants** si l'université dispose des droits de gestion d'acteurs (`POST /actors/create-managed-user`).

### 2.2 Citoyen — Alice (`/alice` — User)

Écran principal : `CitizenHome`, avec les pages `citizen/RequestVerificationPage` et `citizen/SellTitlePage`. Fonctions :
- **Consulter ses documents** (`GET /documents/my`) et leur historique de versions.
- **Demander une vérification** à un tiers (`RequestVerificationPage`) : sélectionner le document et l'institution destinataire.
- **Vendre/transférer un titre** (`SellTitlePage`, pour les documents transférables comme un titre foncier) : initie la première étape du transfert à triple signature (voir [03-WORKFLOW.md](03-WORKFLOW.md) §4.4).
- **Signer une demande de transfert** (`pages/TransferSign.js`) en tant que vendeur ou acheteur.
- **Partager un document** via un lien à durée de vie limitée, révocable à tout moment.
- **Suivre ses notifications** en temps réel (`NotificationsPage`, WebSocket).
- **Consulter son profil et son DID** (`pages/Profile.js`).

### 2.3 Entreprise (`/company` — Verifier)

Écran principal : `VerifierHome`. Fonctions :
- **Vérifier un document reçu** (`DocumentVerifyPanel`) : saisie du `token_id` ou scan QR (`QrScanDialog`), vérification directe sur la blockchain — fonctionne même hors ligne de l'émetteur.
- **Consulter les demandes de vérification en attente** (`PendingVerificationsPanel`) et y répondre (valider/rejeter).
- **Émettre une attestation d'emploi** à un candidat/employé (même formulaire d'émission que l'université, restreint à ses propres employés).

### 2.4 Banque (`/bank` — Bank/Verifier)

Écran principal : `BankHome`. Fonctions :
- **Instruire une demande de prêt** : consulter le workflow `LOAN_APPLICATION` initié par le citoyen.
- **Vérifier l'attestation d'emploi** jointe à la demande, directement sur la blockchain.
- **Consulter les dossiers KYC** soumis par les citoyens (`GET /verification/kyc/pending`) et les valider/rejeter (`POST /verification/kyc/{id}/review`).
- **Accorder ou refuser le prêt** en fonction du résultat de vérification.

### 2.5 Notaire (`/state` — Notary)

Écran principal : `NotaryHome`. Fonctions :
- **Valider un transfert de titre foncier** : consulter les transferts en attente de finalisation notariale (vendeur et acheteur ont déjà signé), signer et finaliser (`POST /workflows/transfer/notary-finalize`) — cette action déclenche le transfert de propriété on-chain.
- **Valider un workflow générique** en attente notariale (`POST /workflows/{id}/validate-by-notary`), pour les cas hors transfert de titre.
- **Consulter l'historique des actes notariés**.

### 2.6 Admin (gestion transverse)

Fonctions accessibles via les endpoints `/admin/*` (pas de tableau de bord dédié listé séparément, intégré selon le contexte de déploiement) :
- **Créer des comptes institutionnels** (université, entreprise, banque, notaire) avec attribution du rôle on-chain correspondant.
- **Émettre et importer des titres fonciers** (`land-titles/ocr-extract`, `land-titles/import`), y compris par OCR d'un titre existant.
- **Vue d'ensemble** de tous les documents et workflows de la plateforme (`GET /admin/documents`, `GET /admin/workflows`).
- **Statistiques et santé du réseau** (`GET /stats/overview`, `GET /stats/activity`, `GET /network/status`).

## 3. Wallet mobile (citoyen)

Application Expo/React Native (`apps/wallet/`) — voir [WALLET.md](WALLET.md) pour la configuration technique. Parcours principal (écrans, `apps/wallet/src/screens/`) :

1. **Onboarding / Inscription** (`OnboardingScreen`, `RegisterScreen`, `LoginScreen`) — création ou connexion au compte, génération du DID.
2. **Verrouillage local** (`SetupPinScreen`, `LockScreen`) — protection par code PIN de l'accès à l'application (indépendant du mot de passe du compte serveur).
3. **Tableau de bord** (`DashboardScreen`) — vue d'ensemble des documents détenus.
4. **Détail d'un document** (`DocumentDetailScreen`) et **historique de versions** (`DocumentHistoryScreen`).
5. **Vérification KYC** (`KycVerificationScreen`) — parcours OTP téléphone/email, OCR carte d'identité, correspondance faciale (voir [03-WORKFLOW.md](03-WORKFLOW.md) §5).
6. **Partage d'un document** (`ShareScreen`, `ShareQRScreen`) — génère un lien/QR code de partage sélectif, à durée de vie limitée.
7. **Gestion des partages actifs** (`SharesScreen`) — consultation et révocation.
8. **Scanner un document/QR tiers** (`ScanScreen`) pour vérifier un document reçu.
9. **Résultat de vérification** (`VerifyScreen`, `VerifyResultScreen`, `VerifySelectiveResultScreen`).
10. **Portefeuille de documents** (`WalletListScreen`) et **profil** (`ProfileScreen`).

## 4. Explorateur de blocs (audit indépendant)

`http://explorer.localhost:8000` (Blockscout) — permet à n'importe qui (citoyen, auditeur, journaliste) de consulter les blocs, transactions et comptes du réseau Besu **sans passer par l'API TrustWedge**, pour vérifier que la plateforme ne peut pas falsifier son propre historique. Utile notamment pour retrouver la transaction de mint d'un document donné, à partir de l'adresse du titulaire.

## 5. Documentation API interactive

`http://localhost:8000/api/docs` (Swagger UI) — utile pour un intégrateur tiers souhaitant appeler l'API de vérification publique depuis son propre système d'information (ex. un ATS d'entreprise qui vérifie automatiquement les diplômes des candidats).

## 6. Dépannage rapide

| Symptôme | Piste |
|---|---|
| La connexion échoue | Vérifier que l'email est bien enregistré (`POST /auth/register` sinon) ; le mot de passe n'est pas vérifié en MVP, seul l'email compte |
| `docker compose ps` montre un conteneur `besu-node-*` non `healthy` | Voir [README](../README.md) § "Points corrigés" pour les problèmes connus de génération de clés/volumes |
| Une vérification de document échoue alors qu'il a été émis | Vérifier que le backend a bien été redémarré après le déploiement du contrat (`CONTRACT_ADDRESS` à jour dans `.env`) |
| L'explorateur Blockscout n'affiche pas de blocs récents | Vérifier `curl http://explorer-api.localhost:8000/api/v2/blocks` et l'état des conteneurs `blockscout`/`blockscout-db` |
| Erreurs générales de démarrage | Consulter le détail complet des correctifs déjà appliqués dans le [README](../README.md) § "Points corrigés par rapport au script d'origine" |

Pour toute question de sécurité ou de mise en production, se référer à [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md).
