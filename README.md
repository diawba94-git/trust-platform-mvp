# TRUSTWEDGE

Plateforme de sécurisation et vérification de documents (blockchain Besu QBFT + IPFS + PostgreSQL + FastAPI + React).

## Structure

- `services/backend` — API FastAPI
- `services/nodes` — données et clés des nœuds Besu (node-1 à node-4)
- `services/postgres-data` — données persistantes PostgreSQL
- `services/ipfs-data` — données persistantes IPFS
- `services/frontend` — application React
- `services/blockscout-data` — données persistantes PostgreSQL de l'explorateur Blockscout
- `config` — configuration du réseau QBFT (générée par le script)
- `scripts` — scripts d'initialisation
- `apps/wallet` — wallet mobile (React Native / Expo), voir [docs/WALLET.md](docs/WALLET.md)
- `packages/shared`, `packages/sdk` — types partagés et client API/blockchain utilisés par le wallet

## Documentation

Spécifications, architecture, workflow métier, mise en production, business plan et guide d'utilisation : voir [docs/README.md](docs/README.md).

## Prérequis

- Docker et Docker Compose installés
- Ports disponibles côté hôte : **8000/8443 (Kong — point d'entrée unique : frontend, API, IPFS gateway et explorateur)**, 30403-30406 (P2P Besu), 127.0.0.1:8645 (RPC Besu, loopback uniquement — déploiement Hardhat), 4001 (IPFS swarm), 5442 (Postgres)
- Depuis la mise en place de Kong, le frontend (3000), le backend (8010), l'API/gateway IPFS (5001/8080) et le RPC Besu (8646-8648) ne sont plus exposés directement — tout passe par Kong. Ajouter `explorer.localhost` et `explorer-api.localhost` fonctionne nativement sur Windows/navigateurs modernes (résolution `*.localhost` → 127.0.0.1), sans toucher au fichier hosts.

## Lancement

1. `node scripts/init-environment.js` — génère `.env` (secrets aléatoires) et le réseau Besu QBFT (clés + `genesis.json`) en une seule commande ; sans risque à rejouer (idempotent). Détail : [docs/10-INITIALISATION-ENVIRONNEMENT.md](docs/10-INITIALISATION-ENVIRONNEMENT.md).
2. `docker compose up -d` — démarre tous les services
3. Ouvrir http://localhost:8000

## Points corrigés par rapport au script d'origine

- Le `docker-compose.yml` utilisait `$(cat /data/key.pub | sed ...)` directement dans `command:`, ce qui ne fonctionne pas sans shell — les services besu-node-2/3/4 utilisent maintenant `entrypoint: ["/bin/sh", "-c"]` et montent le dossier `data` de node-1 en lecture seule (`/nodes-node1`) pour lire sa clé publique.
- Les volumes `./services/nodes/node-N:/data` montaient le dossier parent au lieu du sous-dossier `data`, ce qui plaçait les clés générées à `/data/data/key` au lieu de `/data/key` : Besu ne les trouvait pas et générait une identité aléatoire à chaque démarrage, empêchant tout consensus QBFT (aucun nœud n'était reconnu comme validateur). Les volumes pointent maintenant directement vers `./services/nodes/node-N/data`.
- `scripts\generate-network.bat` ne quotait pas les arguments `-v` de `docker run`, ce qui cassait la commande dès que le chemin du projet contenait un espace.
- Les conteneurs `besu-node-1..4` et le sous-réseau `172.25.0.0/16` entraient en conflit avec un autre projet Docker local (`gestion-fonciere`) : conteneurs renommés `trust-besu-node-*` et sous-réseau déplacé vers `172.26.0.0/16` (IP des nœuds sur `.10-.13` pour laisser la plage basse aux IP dynamiques d'ipfs/postgres/backend/frontend).
- Les ports hôte 8545-8548, 30303-30306, 8000 et 5432 étaient déjà utilisés par d'autres projets locaux : remappés vers 8645-8648, 30403-30406, 8010 et 5442 (ports internes aux conteneurs inchangés).
- `backend/requirements.txt` épinglait `ipfshttpclient==0.8.0`, une version inexistante sur PyPI — remplacée par `0.7.0`.
- `backend/Dockerfile` lançait Uvicorn avec `--reload` : son watcher de fichiers plante avec Docker Desktop sur un volume monté depuis Windows (`Cannot allocate memory`) — flag retiré.
- Le volume `./services/backend:/app` écrasait `/app/main.py` (copié par le Dockerfile) en remontant tout `backend/` par-dessus, y compris le sous-dossier `app/` : la cible du montage est maintenant `./services/backend/app:/app`.
- Le frontend React n'avait ni `public/index.html`, ni `src/index.js`, ni `src/App.js` — sans eux, `npm run build` échoue. Une base minimale a été ajoutée (page affichant le statut de l'API).
- `backend/app/ipfs_utils.py` utilisait `ipfshttpclient` (abandonné depuis 2020), incompatible avec le schéma de version de Kubo moderne (`0.43.0` rejeté par un contrôle de version codé en dur) — remplacé par des appels HTTP directs à l'API Kubo via `requests`.
- `backend/app/blockchain.py` utilisait `signed_tx.raw_transaction` (convention web3.py v7+) alors que `requirements.txt` épingle `web3==6.11.1`, qui expose `.rawTransaction` (camelCase) — corrigé.
- `WorkflowEngine.issue_document_with_workflow` était appelée par `main.py` mais n'existait nulle part — implémentée (upload IPFS, mint on-chain, enregistrement DB, notification WebSocket).
- L'image `blockscout/frontend` (Docker Hub) n'existe pas — le frontend Blockscout est publié sur GitHub Container Registry (`ghcr.io/blockscout/frontend`).

## Passerelle Kong

Le frontend, l'API, l'IPFS gateway et l'explorateur Blockscout passent désormais tous par [Kong](https://konghq.com/) (`http://localhost:8000`) — point d'entrée unique de l'application — qui centralise CORS et rate limiting (300 req/min). Le frontend, le backend, IPFS et le RPC Besu ne sont plus accessibles directement depuis l'hôte.

- Routage par **chemin** : `/` → frontend (SPA React), `/api/*` → backend (préfixe retiré), `/ws/*` → WebSocket backend, `/ipfs/*` → IPFS gateway. La route `/` est un "catch-all" mais Kong priorise automatiquement les chemins les plus spécifiques, donc pas de conflit avec `/api`, `/ws`, `/ipfs`.
- Routage par **nom d'hôte** pour Blockscout (`explorer.localhost`, `explorer-api.localhost`) : une app Next.js référence ses assets en chemin absolu depuis la racine, un préfixe de chemin les aurait cassés
- Configuration déclarée dans `scripts/kong-setup.sh` (exécuté automatiquement au démarrage par le service `kong-setup`, idempotent — relançable sans effet de bord)
- Kong Admin API (8001) et Kong Manager (8002) ne sont **pas** publiés vers l'hôte : l'Admin API de Kong n'a pas d'authentification native en édition Community, l'exposer serait une porte ouverte sur toute la configuration de la gateway. Pour y accéder ponctuellement : `docker exec -it trust-kong curl http://localhost:8001/...`
- L'authentification applicative (JWT métier) reste gérée par le backend lui-même (`/auth/login`) — Kong n'a volontairement **pas** de plugin `jwt`/`key-auth` superposé, pour éviter deux systèmes d'authentification à maintenir en parallèle et le risque de divergence entre eux
- Certificat HTTPS (port 8443) : auto-signé par défaut (Kong "snake oil") en local — à remplacer par un vrai certificat avant toute exposition publique réelle
- **Production** : en attendant un vrai domaine/DNS, l'API reste accessible en `localhost` nu (pas de host-based routing). Une fois le domaine en place, remplacer `REACT_APP_API_URL`/`REACT_APP_WS_URL` dans `.env` par ce domaine et ajouter la contrainte `hosts` correspondante sur les routes dans `scripts/kong-setup.sh` (même principe que `explorer.localhost` actuellement).

## Comptes de test

Comptes déjà enregistrés en base (mot de passe identique pour tous : `test1234`) — un compte par rôle/tableau de bord :

| Email | Mot de passe | Rôle | Tableau de bord |
|---|---|---|---|
| `university@trustwedge.com` | `test1234` | ISSUER | `/university` — émission de diplômes |
| `alice@trustwedge.com` | `test1234` | USER | `/alice` — espace citoyen, documents & demandes |
| `company@trustwedge.com` | `test1234` | VERIFIER | `/company` — vérification côté entreprise |
| `bank@trustwedge.com` | `test1234` | VERIFIER | `/bank` — vérification pour un dossier de prêt |
| `notary@trustwedge.com` | `test1234` | NOTARY | `/state` — validation notariale des transferts |

> Le MVP ne vérifie pas le mot de passe à la connexion (`login_user` ne fait que retrouver l'utilisateur par email, voir section Sécurité) : n'importe quel mot de passe fonctionne une fois l'email enregistré. `test1234` est indiqué pour la cohérence de la démo.

Pour créer un nouveau compte : `POST /auth/register` (voir étape 4 ci-dessous).

📄 [**docs/ParcoursAlice.html**](docs/ParcoursAlice.html) — guide pas-à-pas du cycle de confiance complet (DID, diplôme, emploi, prêt, foncier) à travers l'interface, écran par écran.

## Tester l'application

### 1. Démarrage complet (première fois ou après un `docker compose down`)

```bash
node scripts/init-environment.js             # génère .env + les clés/genesis.json (une seule fois)
docker compose up -d --build                 # démarre les 11 conteneurs
cd services\nodes && npm install             # dépendances Hardhat (une seule fois)
npx hardhat run scripts/deploy.js --network besu   # déploie le contrat, met à jour CONTRACT_ADDRESS dans .env
cd ..\..
docker compose up -d backend                 # redémarre le backend avec la nouvelle CONTRACT_ADDRESS
```

### 2. Vérifier que tout tourne

```bash
docker compose ps                            # tous les conteneurs doivent être "Up" (besu-node-* "healthy")
curl http://localhost:8000/api/health        # {"status":"healthy",...} — via Kong
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://127.0.0.1:8645                      # le numéro de bloc doit augmenter entre deux appels
curl http://explorer-api.localhost:8000/api/v2/blocks   # Blockscout doit renvoyer les blocs indexés
```

### 3. Interface web

Ouvrir http://localhost:8000, `/login` (n'importe quel email/mot de passe déjà enregistré), puis `/university`, `/alice`, `/company`, `/bank`, `/state`.
Swagger de l'API : http://localhost:8000/api/docs
Explorateur de blocs Blockscout : http://explorer.localhost:8000 (blocs, transactions, comptes du réseau Besu QBFT)

### 4. Test fonctionnel de bout en bout (API)

Utilise les comptes de test ci-dessus (déjà enregistrés) :

```bash
# Connexion (université, ISSUER) -> récupérer access_token
curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"university@trustwedge.com","password":"test1234"}'

# Émission d'un document pour Alice (mint on-chain + upload IPFS + enregistrement DB)
curl -X POST http://localhost:8000/api/documents/issue -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_UNIVERSITY>" \
  -d '{"owner_did":"did:ethr:0xA2000000000000000000000000000000000002","doc_type":"DIPLOMA","attributes":[{"key":"field","value":"CS","valueType":"string"}],"file_content":"hello world","filename":"diploma.pdf","is_transferable":false}'
# -> renvoie token_id et ipfs_cid

# Vérification on-chain du document émis (aucune authentification requise)
curl http://localhost:8000/api/documents/verify/<token_id>
# -> {"isValid":true, "docType":"DIPLOMA", "ipfsCid":"Qm...", ...}

# Retrouver la transaction de mint sur Blockscout : ouvrir dans un navigateur
# http://explorer.localhost:8000/address/0xA2000000000000000000000000000000000002
```

Le cycle de workflow complet (`/workflows/create` → `start` → `request-verification` → `submit-verification` → `request-notary` → `validate-by-notary`) se teste de la même façon, en enchaînant les appels avec le token de chaque acteur concerné : `university` (initiateur) → `company` ou `bank` (vérificateur) → `notary` (notaire).

### 5. Arrêt

```bash
docker compose down          # conserve les volumes (données Postgres/IPFS/blockchain)
docker compose down -v       # supprime aussi les volumes nommés (pas les bind mounts sous services/)
```

## Sécurité

- Le fichier `.env` contient des secrets d'exemple (`JWT_SECRET`, `ADMIN_PASSWORD`, mot de passe Postgres, `PRIVATE_KEY`). À changer avant tout déploiement autre que local/dev.
- `POST /auth/login` (`backend/app/auth.py`) ne vérifie **pas** le mot de passe : il retrouve l'utilisateur par email et émet un token JWT valide quel que soit le mot de passe fourni. `register_user` ne stocke d'ailleurs aucun hash de mot de passe (`get_password_hash`/`verify_password` existent mais ne sont appelés nulle part). À corriger avant tout usage réel.
- Toutes les émissions/transferts on-chain (`BlockchainClient`) sont signés avec la même clé (`PRIVATE_KEY` dans `.env`), quel que soit l'utilisateur authentifié qui appelle l'API — il n'y a pas de séparation de clé par utilisateur.
