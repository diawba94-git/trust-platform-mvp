# TrustWedge — Description détaillée des services

> Document 7/11 de la documentation projet. Voir [docs/README.md](README.md) pour l'index complet.
> Complète [02-ARCHITECTURE.md](02-ARCHITECTURE.md) (vue d'ensemble) avec le détail technique de **chaque conteneur** défini dans `docker-compose.yml`, plus les modules internes du backend et les applications clientes.

## 1. Tableau de synthèse

| Service (docker-compose) | Image / build | Rôle | Port(s) hôte | Exposé publiquement |
|---|---|---|---|---|
| `besu-node-1` | `hyperledger/besu:latest` | Validateur QBFT n°1, RPC de déploiement | 30403 (P2P), 127.0.0.1:8645 (RPC, loopback) | P2P oui, RPC non (loopback) |
| `besu-node-2/3/4` | `hyperledger/besu:latest` | Validateurs QBFT n°2-4 | 30404-30406 (P2P) | P2P oui |
| `postgres` | `postgres:15-alpine` | Base applicative TrustWedge | 5442→5432 | Oui (à restreindre en prod) |
| `ipfs` | `ipfs/kubo:latest` | Nœud IPFS (stockage fichiers) | 4001 (swarm) | Swarm oui, API/gateway via Kong seulement |
| `backend` | build `services/backend` | Module **core** : stats, notifications, WebSocket, `/users`, KYC | — (`expose: 8000`) | Non, via Kong `/api/*` (catch-all) |
| `auth` | build `services/auth` | Module **auth** : inscription/connexion, émission JWT | — (`expose: 8000`) | Non, via Kong `/api/auth/*` |
| `identity` | build `services/identity` | Module **identity** : acteurs, DID, rôles on-chain | — (`expose: 8000`) | Non, via Kong `/api/admin/actors/*`, `/api/actors/*`, `/api/did/*` |
| `documents` | build `services/documents` | Module **documents** : émission, workflows, vérification, divulgation | — (`expose: 8000`) | Non, via Kong `/api/documents/*`, `/api/workflows/*`, `/api/verification/*` |
| `verify` | build `services/verify` | Module **verify** : vérification publique, lecture seule | — (`expose: 8000`) | Non, via Kong `/api/documents/verify/*` |
| `storage` | build `services/storage` | Module **storage** : wrapper IPFS, interne uniquement | — (`expose: 8000`) | Non — jamais routé via Kong, appelé en HTTP interne seulement |
| `exchange` | build `services/exchange` | Module **exchange** : transferts, partages | — (`expose: 8000`) | Non, via Kong `/api/workflows/transfer/*`, `/api/shares/*` |
| `frontend` | build `services/frontend` | SPA React (servie par un serveur statique) | — (`expose: 80`) | Non, via Kong `/` |
| `blockscout-db` | `postgres:15-alpine` | Base dédiée à l'explorateur | — | Non |
| `blockscout` | `blockscout/blockscout:latest` | Backend indexeur de blocs | — | Non, via Kong (`explorer-api.localhost`) |
| `blockscout-frontend` | `ghcr.io/blockscout/frontend:latest` | UI de l'explorateur | — | Non, via Kong (`explorer.localhost`) |
| `kong-database` | `postgres:13-alpine` | Base de configuration Kong | — | Non |
| `kong-migrations` | `kong:3.6` | Job one-shot : initialise le schéma Kong | — | — (tâche, pas un service persistant) |
| `kong` | `kong:3.6` | Passerelle API — **seul point d'entrée public** | **8000 (HTTP), 8443 (HTTPS)** | Oui, volontairement |
| `kong-setup` | `curlimages/curl:8.10.1` | Déclare services/routes/plugins Kong au démarrage | — | — (tâche, idempotente) |

Réseau Docker unique `trustwedge-network` (bridge, sous-réseau `172.26.0.0/16`), tous les services s'y résolvent par leur nom de conteneur (ex. `http://backend:8000`, `http://besu-node-1:8545`).

## 2. Réseau blockchain — `besu-node-1..4`

- **Rôle** : réseau privé à 4 validateurs, consensus **QBFT** (Byzantine Fault Tolerant) — tolère la défaillance d'1 nœud sur 4 sans interrompre la production de blocs.
- **Paramètres consensus** (`config/qbftConfigFile.json`) : `chainId=1337` (dev), période de bloc **2 secondes**, timeout de requête **4 secondes**, longueur d'époque **30000 blocs**.
- **Stockage** : format `BONSAI` (format d'état optimisé de Besu).
- **node-1** est le nœud "bootnode" : les 3 autres pointent vers lui (`--bootnodes=enode://...@172.26.0.10:30303`) pour découvrir le réseau P2P, et montent son dossier de données en lecture seule pour lire sa clé publique.
- **API RPC exposées par nœud** : node-1 expose `ETH,NET,QBFT,WEB3,ADMIN,DEBUG,TXPOOL` (le plus complet, utilisé pour le déploiement Hardhat) ; node-2/3 exposent un sous-ensemble proche ; node-4 (utilisé par Blockscout pour le mode "trace") expose `ETH,NET,WEB3,DEBUG,TRACE,TXPOOL`.
- **`--rpc-http-cors-origins=*` et `--host-allowlist=*`** au niveau Besu lui-même : sans conséquence en l'état car seul node-1 est exposé, et uniquement en loopback (127.0.0.1) — à ne jamais élargir sans réévaluer l'exposition.
- **Génération** : `scripts/generate-network.bat` — génère les clés (privée/publique) de chaque nœud et le `genesis.json` de démarrage. Doit être **rejouée avec des clés neuves** pour tout réseau de production (ne jamais réutiliser les clés de développement).

## 3. Contrats — mécanisme de déploiement (`services/nodes`)

- **Outil** : Hardhat (`hardhat.config.js`, réseau `besu` pointant sur `127.0.0.1:8645`).
- **Compilateur** : Solidity `^0.8.28`.
- **Dépendances** : OpenZeppelin Contracts (`ERC721URIStorage`, `AccessControl`, `Counters`, `Strings`).
- **Déploiement** : `npx hardhat run scripts/deploy.js --network besu` → écrit l'adresse déployée, à reporter manuellement dans `CONTRACT_ADDRESS` (`.env`) puis à faire prendre en compte par le backend (redémarrage).
- Détail des deux contrats (`DocumentRegistry.sol`, `EthereumDIDRegistry.sol`) : [02-ARCHITECTURE.md](02-ARCHITECTURE.md) §3.

## 4. `postgres` — base applicative

- **Image** : `postgres:15-alpine`.
- **Rôle** : persiste l'état applicatif miroir de la blockchain (`Document`), plus tout ce qui n'a pas vocation à être on-chain (`User`, `Workflow`, `Notification`, `KycVerification`, `DocumentShare`...). Schéma complet : [09-SPECIFICATION-TECHNIQUE-DONNEES.md](09-SPECIFICATION-TECHNIQUE-DONNEES.md).
- **Création du schéma** : `Base.metadata.create_all(bind=engine)` au démarrage du backend (SQLAlchemy) — pas de système de migration (Alembic) à ce stade, donc pas d'historique de migration versionné.
- **Port hôte 5442** (au lieu de 5432 par défaut) pour éviter un conflit avec d'autres projets locaux.

## 5. `ipfs` — stockage de fichiers

- **Image** : `ipfs/kubo:latest`, profil `server`.
- **Rôle** : stocke les fichiers (PDF générés) référencés par leur CID dans les documents on-chain.
- **Accès** : API et gateway HTTP **non exposées directement** à l'hôte — uniquement via le module `storage` (`/internal/storage/*`, réseau interne) et via Kong (`/ipfs/*`, lecture seule, gateway).
- **Port hôte 4001** : swarm P2P IPFS (nécessaire pour le fonctionnement du réseau IPFS lui-même, indépendant de l'usage applicatif).
- **Client** (`services/storage/app/main.py`) : appels HTTP directs à l'API Kubo via `requests` (la librairie `ipfshttpclient`, abandonnée depuis 2020, est incompatible avec les versions récentes de Kubo). C'est désormais le **seul** module backend qui parle directement à IPFS — les autres passent par lui (§4.2 de l'architecture).

## 6. Backend — 6 modules FastAPI + module core

Voir détail de la répartition des routes et des appels HTTP internes dans [02-ARCHITECTURE.md](02-ARCHITECTURE.md) §4. Éléments d'exécution communs aux 7 services (`backend`, `auth`, `identity`, `documents`, `verify`, `storage`, `exchange`) :

- **Build** : chaque service a son propre `Dockerfile` et `requirements.txt`, mais un **contexte de build commun** (`context: .` à la racine du repo dans `docker-compose.yml`) pour permettre à chacun de `COPY packages/backend-shared` (bibliothèque d'auth partagée, voir §10) lors de la construction de l'image.
- **Dépendances runtime** : `postgres` (tous), `besu-node-1` (`identity`, `documents`, `verify`, `exchange` — signature/lecture on-chain), `storage` (`documents`, `verify`, `exchange` — accès IPFS interne).
- **Non exposés à l'hôte** : `expose: 8000` seulement pour chacun (visible sur le réseau Docker interne), accessibles depuis l'extérieur uniquement via Kong — sauf `storage`, jamais routé par Kong (§1).
- **Bibliothèques clés communes** : `fastapi`, `sqlalchemy`, `trustwedge_auth` (JWT + hash de mot de passe, `bcrypt==4.0.1` pinné pour compatibilité avec `passlib==1.7.4`). `identity`/`documents`/`verify`/`exchange` ajoutent `web3==6.11.1` ; `backend` (core) et `identity` ajoutent `pytesseract`/`pdf2image`/`Pillow` (OCR) ; `documents` ajoute `reportlab` (génération de PDF).

### 6.1 `auth` — inscription, connexion, JWT

Seul service qui vérifie un mot de passe et émet un JWT (`POST /api/auth/register`, `POST /api/auth/login`, définis directement sur l'app plutôt que via un routeur dédié). Le plus léger des 7 services — pas de dépendance à `web3`/IPFS.

### 6.2 `identity` — acteurs, DID, rôles on-chain

`routers/admin.py` (création d'acteurs institutionnels), `routers/actors.py` (création d'utilisateur géré), `routers/did.py` (consultation/régénération DID), `routers/internal.py` (`/internal/identity/by-address`, appelé par `documents`). Appelle `documents` (émission automatique de la carte d'identité d'un nouvel acteur) et `storage` en HTTP interne — les endpoints de création d'acteur sont déclarés en `def` (non `async def`) pour permettre à FastAPI de les exécuter dans un pool de threads, évitant un blocage mutuel avec l'appel entrant depuis `documents` pendant le même cycle de requête.

### 6.3 `documents` — émission, workflows, vérification, divulgation, KYC*

Détient `workflow_engine.py` (machine à états des 5 types de workflow, voir [03-WORKFLOW.md](03-WORKFLOW.md)) et les clés de signature nécessaires à l'émission. `routers/internal.py` expose `/internal/documents/issue-id-card` (appelé par `identity`), `/internal/documents/{token_id}/status` et `/internal/documents/{token_id}/mark-transferred` (appelés par `exchange`).

> \* Les routeurs KYC (`kyc.py`, `verification.py`) sont restés sur le module **core** (`backend`), pas sur `documents` — voir §6.7.

### 6.4 `verify` — vérification publique

Lecture seule, **aucune clé de signature** — appelle `identity`/`storage` en HTTP interne pour enrichir le résultat de vérification (nom de l'émetteur, fichier).

### 6.5 `storage` — wrapper IPFS

`/internal/storage/upload`, `/upload-and-pin`, `/hash`, `/file/{cid}` — sans authentification (réseau Docker interne uniquement, jamais exposé via Kong). Seul module qui dépend d'IPFS directement.

### 6.6 `exchange` — transferts, partages, divulgation

`routers/transfers.py` (transfert à triple signature), `shares.py` (liens de partage), `disclosure.py` (vérification de divulgation sélective). Appelle `documents`/`identity`/`storage` en HTTP interne plutôt que d'accéder directement à leurs tables.

### 6.7 `backend` — module core (résiduel)

Ce qui n'a pas été redistribué lors du découpage : `main.py` (`/health`, `/ws/{user_id}`, `/internal/notify`, `/internal/push`, `/users`), `routers/kyc.py`, `verification.py` (parcours KYC citoyen — restauré après une suppression jugée à tort, voir [01-SPECIFICATIONS.md](01-SPECIFICATIONS.md)), `stats.py`, `notifications.py`. Conserve aussi les services OCR/correspondance faciale (§10) utilisés par le parcours KYC. C'est le seul service qui reste routé par le catch-all Kong `/api/*` (`strip_path: true`) hérité de l'architecture pré-découpage.

## 7. `frontend` — application web React

- **Build** : `services/frontend`, arguments de build `REACT_APP_API_URL`/`REACT_APP_WS_URL` injectés à la compilation (donc figés dans le bundle statique généré — un changement de ces valeurs nécessite un rebuild, pas seulement un redémarrage).
- **Service** : build statique servi sur le port interne 80, exposé uniquement via Kong (`/`).
- **Contenu** : une Console technique commune (menu adapté par rôle) plutôt que des tableaux de bord séparés — voir [06-GUIDE-UTILISATION.md](06-GUIDE-UTILISATION.md).

## 8. `blockscout` + `blockscout-db` + `blockscout-frontend` — explorateur de blocs

- **`blockscout-db`** : PostgreSQL dédiée (isolée de la base applicative TrustWedge), identifiants fixes `blockscout/blockscout` en local — **à changer en production** (actuellement en clair dans `docker-compose.yml`, contrairement aux autres bases qui utilisent des variables `.env`).
- **`blockscout`** : indexeur qui lit en continu les blocs depuis `besu-node-1` (HTTP JSON-RPC) et `besu-node-4` (endpoint "trace"), stocke l'historique indexé côté `blockscout-db`. Démarre par une migration (`bin/blockscout eval "Elixir.Explorer.ReleaseTasks.create_and_migrate()"`) avant de lancer le serveur.
- **`blockscout-frontend`** : UI Next.js, image publiée sur GitHub Container Registry (pas Docker Hub). Configurée pour interroger l'API via Kong avec des noms d'hôte dédiés (`explorer.localhost` / `explorer-api.localhost`) plutôt qu'un préfixe de chemin, car l'app référence ses assets en chemin absolu depuis la racine.
- **Rôle sécurité** : permet un **audit indépendant** de la chaîne, sans dépendre de l'API TrustWedge — un tiers peut vérifier lui-même qu'aucune transaction n'a été dissimulée ou modifiée après coup.

## 9. `kong` + `kong-database` + `kong-migrations` + `kong-setup` — passerelle API

- **`kong-database`** : PostgreSQL dédiée à la configuration de Kong (services, routes, plugins) — isolée des autres bases.
- **`kong-migrations`** : job one-shot (`kong migrations bootstrap`), s'exécute une fois puis s'arrête (`restart: "no"`), condition de démarrage pour `kong`.
- **`kong`** : seul service exposé publiquement (`8000` HTTP, `8443` HTTPS). `KONG_ADMIN_LISTEN=0.0.0.0:8001` **sans publication du port** vers l'hôte — l'Admin API (sans authentification native en édition Community) reste donc cantonnée au réseau Docker interne.
- **`kong-setup`** : conteneur utilitaire (`curlimages/curl`), exécute `scripts/kong-setup.sh` une seule fois au démarrage pour déclarer services/routes/plugins via l'Admin API. Script idempotent (`PUT`, rejouable sans effet de bord).
- Détail du routage, CORS et rate limiting : [02-ARCHITECTURE.md](02-ARCHITECTURE.md) §7 et [08-SECURITE.md](08-SECURITE.md) §4.

## 10. Modules internes notables (par service)

| Module | Service | Rôle |
|---|---|---|
| `packages/backend-shared/trustwedge_auth/` | Partagé (pip-installable) | `security.py` (hash/vérification bcrypt), `pii.py` (`hash_national_id`, SHA-256), `jwt_utils.py` (émission/vérification JWT, `get_current_user`/`get_current_admin`), `models.py` (`AuthUser`, projection minimale de `users`), `db.py` (session SQLAlchemy paresseuse) |
| `blockchain.py` (`BlockchainClient`) | `identity`, `documents`, `verify`, `exchange` | Encapsule `web3.py` : construction, signature et envoi des transactions vers `DocumentRegistry`, lecture de l'ABI, décodage des erreurs de `revert` |
| `documents_client.py`, `storage_client.py`, `identity_client.py`, `notify_client.py` | selon le service (voir §6.2/6.3/6.6) | Clients HTTP internes vers les autres modules (remplacent les appels directs cross-tables de l'ancien monolithe) |
| `workflow_engine.py` (`WorkflowEngine`) | `documents` | Machine à états des 5 types de workflow métier (voir [03-WORKFLOW.md](03-WORKFLOW.md)) ; appelle `identity_client`/`storage_client`/`notify_client` plutôt que d'accéder directement aux tables d'un autre module |
| `event_bus.py` | `backend` (core) | Bus d'événements WebSocket (notifications temps réel par utilisateur) |
| `services/did_service.py` (`DIDService`) | `identity` | Génération de paire de clés Ethereum par utilisateur, chiffrement/déchiffrement de la clé privée (Fernet) |
| `services/signature_service.py` | `documents`, `exchange` | Signature/vérification de hash en ECDSA (EIP-191 et brut) — utilisé pour le transfert à triple signature |
| `services/pdf_generator.py` | `documents` | Génération des PDF représentatifs des documents/titres (ReportLab) |
| `services/ocr_service.py`, `services/id_card_ocr_service.py` | `backend` (core) | OCR (Tesseract) — réel, utilisé pour les titres fonciers et les cartes d'identité (parcours KYC) |
| `services/face_match_service.py` | `backend` (core) | Correspondance faciale — **mockée** (voir [08-SECURITE.md](08-SECURITE.md) §6) |
| `services/verification_service.py` | `backend` (core) | OTP téléphone/email — logique de vérification réelle (JWT à expiration), envoi SMS/email **mocké** (loggé en console) |
| `services/notification_service.py` | `backend` (core) | Construction des notifications applicatives persistées |

## 11. Applications clientes

### 11.1 Frontend web (React)

Voir [02-ARCHITECTURE.md](02-ARCHITECTURE.md) §8 et [06-GUIDE-UTILISATION.md](06-GUIDE-UTILISATION.md) pour le détail par tableau de bord.

### 11.2 Wallet mobile (`apps/wallet`)

- **Stack** : React Native / Expo (TypeScript).
- **Rôle** : application citoyenne — gestion des documents détenus, partage sélectif, parcours KYC. Détail : [WALLET.md](WALLET.md) et [06-GUIDE-UTILISATION.md](06-GUIDE-UTILISATION.md) §3.
- **Dépendance** : `packages/sdk` (client API/blockchain partagé) et `packages/shared` (types partagés).

### 11.3 `packages/sdk` et `packages/shared`

Espaces de travail npm (`workspaces` du `package.json` racine) : code partagé entre le wallet mobile et, potentiellement à terme, le frontend web — évite la duplication des types et du client API entre les deux applications clientes. Buildés indépendamment (`npm run build:sdk`, `npm run build:shared`), hors du pipeline Docker (`services/frontend` et `services/backend` restent buildés indépendamment par Docker, comme précisé dans le `package.json` racine).

## 12. Dépendances de démarrage (ordre logique)

```mermaid
flowchart LR
    besu1[besu-node-1] --> besu2[besu-node-2/3/4]
    postgres --> auth & identity & documents & verify & exchange & backend
    ipfs --> storage
    besu1 --> identity & documents & verify & exchange
    identity -.->|HTTP interne| documents
    documents -.->|HTTP interne| identity
    exchange -.->|HTTP interne| documents & identity
    documents & verify & exchange -.->|HTTP interne| storage
    documents -.->|HTTP interne| backend
    auth & identity & documents & verify & storage & exchange & backend --> frontend
    besu1 --> blockscout
    besu4[besu-node-4] --> blockscout
    blockscoutdb[blockscout-db] --> blockscout
    blockscout --> blockscoutfe[blockscout-frontend]
    kongdb[kong-database] --> kongmig[kong-migrations]
    kongmig --> kong
    kong --> kongsetup[kong-setup]
```

`docker compose up -d` respecte cet ordre via les `depends_on` déclarés ; le déploiement du contrat (Hardhat, hors Compose) doit intervenir **après** que `besu-node-1` soit sain, et le redémarrage des services on-chain (`identity`, `documents`, `verify`, `exchange`) **après** la mise à jour de `CONTRACT_ADDRESS`.
