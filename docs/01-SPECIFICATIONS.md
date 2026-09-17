# TrustWedge — Spécifications fonctionnelles et techniques

> Document 1/6 de la documentation projet. Voir [docs/README.md](README.md) pour l'index complet.

## 1. Contexte et objectifs

TrustWedge est une plateforme de **sécurisation et de vérification de documents officiels** (diplômes, attestations, titres fonciers, permis...) construite sur une blockchain privée (Besu, consensus QBFT), un stockage de fichiers décentralisé (IPFS) et une identité auto-souveraine (DID — Decentralized Identifiers).

**Objectif métier** : remplacer la vérification manuelle et falsifiable de documents (papier, PDF non signé, coup de téléphone à l'émetteur) par une vérification **instantanée, infalsifiable et traçable**, opposable entre plusieurs institutions qui ne se font pas mutuellement confiance a priori (université, entreprise, banque, notaire, administration).

**Cas d'usage pilote** (voir [03-WORKFLOW.md](03-WORKFLOW.md)) : le cycle de confiance d'Alice — diplôme universitaire → attestation d'emploi → dossier de prêt bancaire → transfert de titre foncier validé par un notaire.

## 2. Périmètre

### 2.1 Inclus dans le MVP actuel

- Émission de documents numériques sous forme de NFT (ERC-721) sur une blockchain privée à 4 validateurs.
- Stockage du fichier associé (PDF) sur IPFS, référencé par son CID dans le NFT.
- Identité décentralisée (DID `did:ethr:0x...`) par utilisateur, avec registre on-chain (`EthereumDIDRegistry`).
- Vérification publique d'un document (sans authentification) à partir de son `token_id`.
- Workflows métier multi-acteurs à états (émission → vérification → validation notariale).
- Transfert de propriété d'un document transférable avec triple signature (vendeur, acheteur, notaire).
- Partage sélectif d'un document via lien à durée de vie limitée (`DocumentShare`).
- Parcours KYC citoyen (OTP téléphone/email, OCR carte d'identité, correspondance faciale).
- 5 tableaux de bord web par rôle + wallet mobile (Expo/React Native).
- Explorateur de blocs public (Blockscout) pour audit indépendant de la chaîne.
- Passerelle API unique (Kong) : routage, CORS, rate limiting.

### 2.2 Explicitement hors périmètre du MVP

- Vérification du mot de passe à la connexion (voir §7 Limitations).
- Signature on-chain différenciée par utilisateur (clé de plateforme unique côté serveur pour les rôles institutionnels sans wallet propre).
- Interopérabilité avec des registres DID externes (autre réseau que le Besu privé du projet).
- Facturation, multi-tenant, ou séparation de données entre plusieurs déploiements clients.
- Conformité réglementaire formelle (RGPD/loi sénégalaise sur les données personnelles) — voir [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md) §5.

## 3. Acteurs et rôles

| Rôle (`UserRole`) | Tableau de bord | Capacités principales | Rôle on-chain équivalent |
|---|---|---|---|
| `ADMIN` | `/admin` (implicite) | Crée les comptes institutionnels, gère les titres fonciers, consulte toutes les stats/workflows | — (pas de rôle contrat dédié) |
| `ISSUER` | `/university` | Émet des documents (diplômes...) pour les utilisateurs qu'il a créés, signe on-chain avec sa propre clé | `ISSUER_ROLE` |
| `VERIFIER` | `/company` | Vérifie des documents partagés, émet des attestations (ex. emploi) | `VERIFIER_ROLE` |
| `BANK` | `/bank` | Même capacité de vérification que `VERIFIER` ; distinction purement applicative pour l'éligibilité aux demandes de prêt | `VERIFIER_ROLE` (partagé) |
| `NOTARY` | `/state` | Valide les transferts de titres (triple signature), valide les workflows en attente notariale | `NOTARY_ROLE` |
| `USER` | `/alice` | Citoyen : consulte ses documents, initie des demandes/workflows, partage des documents, passe le KYC | — |

> Le contrat ne connaît pas la notion de « banque » : `BANK` et `VERIFIER` partagent `VERIFIER_ROLE` on-chain (cf. `services/backend/app/models.py`, `ROLE_TO_CONTRACT_ROLE`).

## 4. Exigences fonctionnelles

### 4.1 Identité (DID)

- Chaque utilisateur créé reçoit une adresse Ethereum et un DID `did:ethr:<adresse>` (`services/backend/app/services/did_service.py`).
- `GET /did/my` : consultation de ses propres identifiants/attestations.
- `POST /did/regenerate` : régénération de la paire de clés d'un utilisateur (réservé aux comptes créés par un émetteur/admin).

### 4.2 Émission de documents

- `POST /documents/issue` : upload du fichier → IPFS, mint du NFT (`issueDocument`) avec attributs typés (`string`/`uint256`/`address`/`date`/`boolean`), enregistrement en base, notification WebSocket au propriétaire.
- Unicité imposée à deux niveaux : couple (`doc_type`, `doc_key`) et hash du contenu (CID) — un même fichier ne peut pas être ré-émis sous une autre référence, une même référence ne peut pas être ré-émise avec un contenu différent par ce canal.
- Génération automatique d'un PDF représentatif du document à partir de ses attributs (`services/pdf_generator.py`) — le fichier envoyé par le formulaire n'est qu'un texte de remplissage.
- `GET /documents/issued` : liste des documents émis par l'utilisateur courant.
- `GET /documents/my` : liste des documents détenus par l'utilisateur courant.
- `GET /documents/{token_id}/versions`, `GET /documents/{token_id}/owner-at` : historique de versions et propriété à une date donnée.
- `POST /documents/{token_id}/verify-file` : vérifie qu'un fichier fourni correspond bien au CID enregistré on-chain.
- `GET /documents/download/{cid}` : téléchargement du fichier depuis IPFS.

### 4.3 Vérification

- `GET /documents/verify/{token_id}` : vérification **publique, sans authentification** de la validité d'un document directement depuis la blockchain (aucune dépendance à la disponibilité de l'émetteur).
- `POST /documents/verify-shared` (divulgation sélective) : vérifie un document partagé sans exposer l'ensemble de ses attributs.

### 4.4 Workflows métier

5 types de workflow (`WorkflowType`), portés par une machine à états commune (`WorkflowStatus` : `PENDING → IN_PROGRESS → AWAITING_VERIFICATION → AWAITING_NOTARY → COMPLETED / REJECTED / CANCELLED`) :

- `DIPLOMA_VERIFICATION`, `EMPLOYMENT_VERIFICATION`, `LOAN_APPLICATION`, `LAND_TRANSFER`, `ID_CARD_ISSUANCE`.

Endpoints : `POST /workflows/create`, `/{id}/start`, `/{id}/request-verification`, `/{id}/submit-verification`, `/{id}/request-notary`, `/{id}/validate-by-notary`, `/{id}/cancel`, `GET /{id}/status`, `GET /workflows/my`.

Détail complet du cycle et des transitions : voir [03-WORKFLOW.md](03-WORKFLOW.md).

### 4.5 Transfert de propriété (titres fonciers et documents transférables)

Mécanisme dédié à triple signature, distinct de la validation notariale générique :

1. `POST /workflows/transfer/initiate` — le vendeur signe une demande de transfert.
2. `POST /workflows/transfer/accept` — l'acheteur signe son acceptation.
3. `POST /workflows/transfer/notary-finalize` — le notaire signe et finalise ; le NFT change de propriétaire on-chain (`finalizeTransfer`) et une nouvelle version du document (nouveau CID) est enregistrée.

### 4.6 Partage sélectif de documents

- `POST /shares`, `GET /shares/mine`, `DELETE /shares/{token}`, `GET /shares/{token}` (résolution publique).
- Un lien de partage ne fait foi de rien par lui-même : sa résolution relit toujours l'état réel du document on-chain, et refuse si le lien est révoqué ou expiré.
- Deux niveaux d'accès : `view` (métadonnées/statut) et `download` (autorise aussi le PDF).

### 4.7 KYC (citoyen, depuis le wallet mobile)

- `POST /verification/phone/send` + `/verify`, `/verification/email/send` + `/verify` : OTP.
- `POST /verification/id-card/extract` : OCR de carte d'identité.
- `POST /verification/face/compare` : correspondance faciale (selfie vs photo carte).
- `POST /verification/kyc/submit`, `GET /verification/kyc/pending`, `GET /verification/kyc/mine`, `POST /verification/kyc/{id}/review` : le dossier KYC est persisté (`KycVerification`) pour permettre une revue humaine réelle côté banque/notaire, alors que les étapes de vérification elles-mêmes sont sans état.

### 4.8 Notifications temps réel

- WebSocket `/ws/{user_id}` : bus d'événements (`event_bus.py`) pour notifier en direct (émission de document, changement de statut de workflow...).
- REST : `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `DELETE /notifications`.

### 4.9 Administration

- `POST /admin/actors/create` : création de comptes institutionnels avec attribution du rôle on-chain correspondant.
- `POST /admin/land-titles/ocr-extract`, `POST /admin/land-titles/import` : import assisté de titres fonciers existants.
- `GET /admin/documents`, `GET /admin/workflows` : vue d'ensemble.
- `GET /stats/overview`, `GET /stats/activity`, `GET /network/status` : indicateurs plateforme et santé du réseau Besu.

### 4.10 Explorateur de blocs

Blockscout, exposé via Kong (`explorer.localhost`), permet à tout tiers de vérifier indépendamment les transactions on-chain (mint, transfert, révocation) sans passer par l'API TrustWedge.

## 5. Exigences non fonctionnelles

| Catégorie | Exigence MVP | Cible production |
|---|---|---|
| Disponibilité | Mono-instance Docker Compose | Haute disponibilité, réplication Postgres, nœuds Besu redondants |
| Sécurité transport | HTTP local / TLS auto-signé (port 8443) | Certificat TLS valide (Let's Encrypt ou CA), HSTS |
| Authentification | JWT, mot de passe **non vérifié** (voir §7) | Vérification de mot de passe + hash, MFA envisageable |
| Autorisation | Rôles applicatifs + rôles on-chain (`AccessControl`) | Inchangé, à durcir (séparation de clé par utilisateur) |
| Traçabilité | Historique on-chain immuable (événements + versions) | Inchangé — atout structurel de l'architecture |
| Performance | Non benchmarké (usage démo) | Définir SLA (temps de mint, temps de vérification) |
| Journalisation | Logs conteneurs Docker | Centralisation (ELK/Loki), rétention définie |
| Localisation | Interface en français | Multilingue envisageable (FR prioritaire, marché Sénégal/Afrique de l'Ouest) |

## 6. Modèle de données (résumé)

Détail colonne par colonne (tables PostgreSQL, structures on-chain, schémas API) : [09-SPECIFICATION-TECHNIQUE-DONNEES.md](09-SPECIFICATION-TECHNIQUE-DONNEES.md). Entités principales :

- **User** — compte applicatif (DID, adresse, rôle, email, clé privée chiffrée le cas échéant).
- **Document** — miroir applicatif du NFT on-chain (token_id, type, clé métier, CID, transférabilité, attributs).
- **Workflow** / **WorkflowStep** — instance de processus métier et son historique d'étapes.
- **Invitation** — proposition d'un document/action entre deux utilisateurs.
- **DocumentShare** — lien de partage à portée et durée de vie limitées.
- **KycVerification** — dossier KYC soumis par un citoyen, avec statut de revue humaine.
- **Notification** — file de notifications par utilisateur.

## 7. Limitations connues du MVP (dette de sécurité assumée)

À corriger impérativement avant toute mise en production réelle (détail des actions : [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md)) :

1. **`POST /auth/login` ne vérifie pas le mot de passe** — retrouve l'utilisateur par email et émet un JWT valide quel que soit le mot de passe fourni (`get_password_hash`/`verify_password` existent mais ne sont jamais appelés).
2. **Signature on-chain mutualisée** — les émissions/transferts pour les rôles sans clé propre (`VERIFIER`/`NOTARY`/`ADMIN`) sont signées avec la clé de plateforme unique (`PRIVATE_KEY`), sans séparation par utilisateur authentifié.
3. **Secrets d'exemple en `.env`** — `JWT_SECRET`, `ADMIN_PASSWORD`, mot de passe Postgres, `PRIVATE_KEY` sont des valeurs de démo, à régénérer avant tout déploiement non local.
4. **CORS ouvert (`allow_origins=["*"]`)** côté FastAPI — à restreindre au(x) domaine(s) réel(s) en production.
5. **Certificat TLS auto-signé** (Kong, port 8443) — à remplacer par un certificat valide avant exposition publique.

## 8. Contraintes techniques (stack)

Voir détail complet dans [02-ARCHITECTURE.md](02-ARCHITECTURE.md) et [07-SERVICES.md](07-SERVICES.md) (description service par service). Résumé :

- **Blockchain** : Hyperledger Besu, consensus QBFT, 4 nœuds validateurs, réseau privé.
- **Smart contracts** : Solidity 0.8.28, OpenZeppelin (`ERC721URIStorage`, `AccessControl`), Hardhat pour le déploiement.
- **Stockage fichiers** : IPFS (Kubo), accès via API HTTP directe.
- **Backend** : Python / FastAPI, SQLAlchemy, `web3.py` 6.11.1.
- **Base de données** : PostgreSQL.
- **Frontend web** : React.
- **Wallet mobile** : React Native / Expo, packages partagés (`packages/sdk`, `packages/shared`).
- **Passerelle** : Kong (Community Edition).
- **Explorateur** : Blockscout.
- **Orchestration locale** : Docker Compose (11 conteneurs).

## 9. Glossaire

| Terme | Définition |
|---|---|
| **DID** | Decentralized Identifier — identifiant d'identité auto-souveraine, format `did:ethr:0x...` utilisé ici. |
| **VC** | Verifiable Credential — attestation vérifiable (diplôme, attestation d'emploi...) rattachée à un DID. |
| **QBFT** | Quorum Byzantine Fault Tolerant — algorithme de consensus utilisé par le réseau Besu du projet (tolère jusqu'à 1 nœud défaillant sur 4). |
| **IPFS / CID** | InterPlanetary File System — stockage de fichiers adressé par contenu ; le CID est l'empreinte unique du fichier. |
| **NFT / ERC-721** | Jeton non fongible — ici, chaque document émis est un NFT unique portant ses métadonnées et son historique. |
| **JWT** | JSON Web Token — jeton d'authentification retourné par `/auth/login`. |
| **Kong** | Passerelle API (reverse proxy) centralisant routage, CORS et rate limiting. |
