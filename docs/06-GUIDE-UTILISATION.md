# TrustWedge — Guide d'utilisation de la solution

> Document 6/11 de la documentation projet. Voir [docs/README.md](README.md) pour l'index complet.
> Pour un pas-à-pas illustré du parcours complet d'Alice, voir [ParcoursAlice.html](ParcoursAlice.html). Ce guide couvre en plus la **Console technique** (interface unique, adaptée par rôle) et le **wallet mobile**.

## 1. Prise en main

### 1.1 Lancer la plateforme

Voir le [README](../README.md) (§ Lancement, § Tester l'application) pour les commandes de démarrage complètes. Résumé :

1. `scripts\generate-network.bat` (une seule fois) — génère le réseau blockchain.
2. `docker compose up -d --build` — démarre les 18 conteneurs (dont les 6 modules backend + le module core, voir [02-ARCHITECTURE.md](02-ARCHITECTURE.md) §2).
3. Déployer le contrat (Hardhat), redémarrer le backend avec l'adresse du contrat.
4. Ouvrir `http://localhost:8000`.

### 1.2 Se connecter

Page de connexion : `http://localhost:8000/login`. Le mot de passe est **réellement vérifié** (bcrypt, module `auth`) — voir [01-SPECIFICATIONS.md](01-SPECIFICATIONS.md) §7. Comptes de test (mot de passe entre parenthèses) :

| Email | Rôle |
|---|---|
| `admin@trustwedge.com` (`admin123`) | ADMIN |
| `ucad@universite.com` (`test1234`) | ISSUER |
| `rh@sonatel.com` (`test1234`) | VERIFIER |
| `notaire@senegal.sn` (`test1234`) | NOTARY |
| `mariama.ndiaye@trustwedge.com` (`test1234`) | USER |

Liste à jour dans le [README](../README.md) (§ Comptes de test). Un compte créé après coup par un admin (`POST /admin/actors/create`) n'a **aucun mot de passe initial** — il faut lui en définir un explicitement (`POST /admin/actors/{id}/set-password`) avant qu'il puisse se connecter.

## 2. Guide par rôle — Console technique

Tous les rôles se connectent à la **même application** (`/console`) : une coquille commune (menu latéral + zone de contenu) dont les entrées de menu varient selon le rôle connecté (`theme/roleThemes.js`), plutôt qu'un tableau de bord séparé par rôle — voir [02-ARCHITECTURE.md](02-ARCHITECTURE.md) §8.

### 2.1 Université (Issuer)

- **Émettre un document** (`/university/issue`, `IssueDocumentPage`) : sélectionner l'étudiant (parmi les comptes que l'université a elle-même créés — restriction volontaire, une université ne peut émettre qu'à ses propres étudiants), renseigner le type de document, la référence unique, les attributs (mention, filière, année...), joindre un fichier. Le PDF final est généré automatiquement par la plateforme à partir des attributs saisis.
- **Créer des comptes étudiants** (`/university/create-did`, `CreateManagedUserPage`) si l'université dispose des droits de gestion d'acteurs (`POST /actors/create-managed-user`).
- **Vérifier un document** (`/university/verify`).
- **Suivre les demandes de vérification** (`/university/requests`) où l'université est sollicitée.

### 2.2 Citoyen (User)

- **Consulter tous ses documents, regroupés par type** (`/dashboard/documents/all`, `MyDocumentsPage`) et leur historique de versions.
- **Demander une vérification** à un tiers (`/dashboard/documents`, `RequestVerificationPage`) : sélectionner le document et l'institution destinataire.
- **Vendre/transférer un titre** (`/dashboard/sell-title`, `SellTitlePage`, pour les documents transférables comme un titre foncier) : initie la première étape du transfert à triple signature (voir [03-WORKFLOW.md](03-WORKFLOW.md) §4.4).
- **Signer une demande de transfert** (`/transfer/:workflowId`, `TransferSign.js`) en tant que vendeur ou acheteur.
- **Gérer les partages** (`/dashboard/shares`, `SharesPage`) via un lien à durée de vie limitée, révocable à tout moment.
- **Vérifier un document externe** (`/dashboard/verify`).
- **Suivre ses notifications** en temps réel (`/notifications`, WebSocket).
- **Consulter son profil et son DID** (`/profile`).

### 2.3 Entreprise (Verifier)

- **Vérifier un document reçu** (`/company/verify`, `DocumentVerifyPanel`) : saisie du `token_id` ou scan QR (`QrScanDialog`), vérification directe sur la blockchain — fonctionne même hors ligne de l'émetteur.
- **Consulter les demandes de vérification en attente** (`/company/requests`, `PendingRequestsPage`) et y répondre (valider/rejeter).
- **Émettre une attestation d'emploi** (`/company/issue`) à un candidat/employé (même formulaire d'émission que l'université, restreint à ses propres employés).
- **Créer des comptes employés** (`/company/create-did`).

### 2.4 Banque (Bank/Verifier)

- **Instruire une demande de prêt** (`/bank/loans`, `PendingRequestsPage`) : consulter le workflow `LOAN_APPLICATION` initié par le citoyen.
- **Vérifier l'attestation d'emploi** (`/bank/verify`) jointe à la demande, directement sur la blockchain.
- **Consulter les demandes KYC** (`/bank/kyc`, `KycReviewPage`) soumises par les citoyens et les valider/rejeter.
- **Créer des comptes clients** (`/bank/create-did`).

### 2.5 Notaire (Notary)

- **Valider un transfert de titre foncier** (`/state/transfers`, `StateTransfersPage`) : consulter les transferts en attente de finalisation notariale (vendeur et acheteur ont déjà signé), signer et finaliser — cette action déclenche le transfert de propriété on-chain.
- **Signer** (`/state/signatures`).
- **Enregistrer un titre foncier** (`/state/register`).
- **Vérifier un document** (`/state/verify`).
- **Consulter les vérifications KYC** (`/state/verifications`, `KycReviewPage`).

### 2.6 Admin (gestion transverse)

- **Créer des comptes institutionnels** (`/admin/create-actor`, université, entreprise, banque, notaire) avec attribution du rôle on-chain correspondant.
- **Définir/réinitialiser le mot de passe d'un acteur** (`POST /admin/actors/{id}/set-password`) — obligatoire après création d'un compte, avant sa première connexion (voir §1.2).
- **Émettre et importer des titres fonciers** (`/admin/land-titles`), y compris par OCR d'un titre existant.
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
| La connexion échoue | Vérifier que l'email est bien enregistré et que le mot de passe est correct (réellement vérifié, bcrypt) ; un compte créé par un admin n'a pas de mot de passe tant que `POST /admin/actors/{id}/set-password` n'a pas été appelé (§1.2) |
| `docker compose ps` montre un conteneur `besu-node-*` non `healthy` | Voir [README](../README.md) § "Points corrigés" pour les problèmes connus de génération de clés/volumes |
| Une vérification de document échoue alors qu'il a été émis | Vérifier que le backend a bien été redémarré après le déploiement du contrat (`CONTRACT_ADDRESS` à jour dans `.env`) |
| L'explorateur Blockscout n'affiche pas de blocs récents | Vérifier `curl http://explorer-api.localhost:8000/api/v2/blocks` et l'état des conteneurs `blockscout`/`blockscout-db` |
| Erreurs générales de démarrage | Consulter le détail complet des correctifs déjà appliqués dans le [README](../README.md) § "Points corrigés par rapport au script d'origine" |

Pour toute question de sécurité ou de mise en production, se référer à [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md).
