# TrustWedge — Script d'initialisation de l'environnement

> Document 10/10 de la documentation projet. Voir [docs/README.md](README.md) pour l'index complet.
> Décrit `scripts/init-environment.js`, qui automatise la première étape du [README](../README.md) (§ Lancement) : générer un `.env` exploitable et le réseau blockchain, avant `docker compose up`.

## 1. Ce que fait le script

```
node scripts/init-environment.js
```

*(ou, sur Windows : `scripts\init-environment.bat`, ou `npm run init` depuis `scripts/`)*

Dans l'ordre :

1. **Génère ou complète `.env`** à partir de [`.env.example`](../.env.example) — chaque valeur marquée `__GENERATE__` (ou manquante) est remplacée par un secret aléatoire cryptographiquement sûr (module `crypto` de Node). Toute valeur déjà renseignée est **laissée intacte**.
2. **Crée les répertoires de données** attendus par `docker-compose.yml` (`services/postgres-data`, `ipfs-data`, `blockscout-data`, `kong-data`, `nodes/node-1..4/data`) s'ils n'existent pas.
3. **Génère le réseau blockchain Besu QBFT** (clés des 4 nœuds + `genesis.json`) en appelant `scripts/generate-network.bat` — **seulement si aucun réseau n'existe déjà**.
4. **Affiche les prochaines étapes** (`docker compose up -d --build`, déploiement du contrat, etc.).

Le script est conçu pour être **rejoué sans risque** (idempotent) : sur un environnement déjà initialisé, il ne modifie rien et l'indique explicitement (`Rien à générer`, `Réseau déjà généré`).

## 2. Pourquoi ce script existe

Avant ce script, initialiser un nouvel environnement demandait de :
- recopier `.env` à la main et inventer chaque secret un par un (risque d'oubli, de valeurs faibles ou de copier-coller entre environnements) ;
- se souvenir de ne **jamais** régénérer `ENCRYPTION_KEY` une fois des DID créés (sinon les clés privées déjà chiffrées en base deviennent illisibles) ni de relancer `generate-network.bat` sur un réseau déjà démarré (invalide l'identité des nœuds) ;
- créer manuellement les dossiers de données bind-mountés par Docker Compose.

Le script encode ces règles une bonne fois pour toutes plutôt que de compter sur la mémoire de chacun.

## 3. Secrets générés

| Variable | Technique de génération | Format produit |
|---|---|---|
| `PRIVATE_KEY` | 32 octets aléatoires (`crypto.randomBytes`), hex, préfixe `0x` | Clé privée Ethereum (secp256k1) — voir [08-SECURITE.md](08-SECURITE.md) §5.3 |
| `ENCRYPTION_KEY` | 32 octets aléatoires, base64 URL-safe | Clé Fernet (AES-128 + HMAC-SHA256) — voir [08-SECURITE.md](08-SECURITE.md) §5.2 |
| `JWT_SECRET` | 48 octets aléatoires, hex (96 caractères) | Secret HMAC pour la signature des JWT (HS256) |
| `SECRET_KEY` | 32 octets aléatoires, hex | Secret générique |
| `POSTGRES_PASSWORD` | 24 caractères alphanumériques aléatoires | Mot de passe base applicative |
| `KONG_PG_PASSWORD` | 16 octets aléatoires, hex (32 caractères) | Mot de passe base Kong |
| `ADMIN_PASSWORD` | 16 caractères alphanumériques aléatoires | Mot de passe du compte admin (voir §5) |
| `BLOCKSCOUT_SECRET_KEY_BASE` | 64 octets aléatoires, base64 | `SECRET_KEY_BASE` Phoenix/Elixir de Blockscout |
| `DATABASE_URL` | Composée à partir de `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB` | `postgresql://<user>:<password>@postgres:5432/<db>` |

`CONTRACT_ADDRESS` n'est **jamais généré** : il reste vide jusqu'au déploiement effectif du contrat (étape manuelle, voir §4).

Toutes les valeurs non sensibles sans équivalent aléatoire pertinent (`BESU_NETWORK_ID`, `JWT_ALGORITHM`, `NODE_ENV`, URLs internes...) reçoivent une valeur par défaut cohérente avec `docker-compose.yml`, uniquement si la variable est totalement absente du fichier.

## 4. Utilisation — premier démarrage

```bash
node scripts/init-environment.js
docker compose up -d --build
cd services/nodes && npm install
npx hardhat run scripts/deploy.js --network besu
cd ../..
# reporter l'adresse affichée dans CONTRACT_ADDRESS (.env)
docker compose up -d backend
```

Ouvrir ensuite `http://localhost:8000` (voir [06-GUIDE-UTILISATION.md](06-GUIDE-UTILISATION.md)).

## 5. Où trouver les secrets générés

Le script **n'affiche aucun secret en clair dans le terminal** (pour éviter qu'ils ne finissent dans un historique de shell ou un log de CI), à l'exception d'une notification signalant que `ADMIN_PASSWORD` vient d'être généré — sa valeur reste à consulter dans `.env` :

```bash
# PowerShell
Select-String ADMIN_PASSWORD .env

# Bash
grep ADMIN_PASSWORD .env
```

> Rappel (voir [01-SPECIFICATIONS.md](01-SPECIFICATIONS.md) §7) : dans l'état actuel du MVP, `POST /auth/login` ne vérifie pas le mot de passe — `ADMIN_PASSWORD` n'est donc pas encore utilisé pour se connecter, mais est généré dès maintenant pour être prêt le jour où la vérification sera branchée (voir [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md) §1).

## 6. Réexécution et rotation de secrets

- **Réexécution simple** (`node scripts/init-environment.js` sur un environnement déjà initialisé) : ne change rien, sans danger. Utile après un `git clone`/copie fraîche du dépôt pour vérifier que rien ne manque.
- **Faire tourner un secret précis** (rotation) : effacer sa valeur dans `.env` (ou la remplacer par `__GENERATE__`), puis relancer le script — seule cette variable sera régénérée.
  - **Exception impérative : `ENCRYPTION_KEY`.** Ne jamais l'effacer/régénérer si des utilisateurs ont déjà une `private_key_encrypted` en base (`users`) — elle deviendrait indéchiffrable. Voir [08-SECURITE.md](08-SECURITE.md) §5.2.
  - **`PRIVATE_KEY`** : la régénérer change l'adresse détenant `ISSUER_ROLE` on-chain côté plateforme — nécessite de re-attribuer le rôle à la nouvelle adresse sur le contrat déjà déployé (`grant_role`), sans quoi les émissions pour les rôles sans clé propre (`VERIFIER`/`NOTARY`/`ADMIN`) échoueront.
- **Environnement de production** : ce script convient pour un premier provisionnement, mais l'inventaire complet des variables et les recommandations spécifiques à la production (coffre-fort de secrets, rotation planifiée...) restent celles de [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md) §4 — à privilégier pour tout environnement exposé.

## 7. Réseau Besu — comportement du script

- Vérifie la présence de `genesis.json` (racine du projet) **et** de `services/nodes/node-1/data/key` pour décider si un réseau existe déjà.
- Si absent : appelle `scripts/generate-network.bat` (nécessite Docker Desktop démarré — le script signale clairement l'échec sinon, sans arrêter le reste de l'initialisation).
- Si présent : **ne régénère jamais automatiquement** — un réseau existant contient l'identité (clés) des nœuds déjà éventuellement démarrés ; le régénérer désynchroniserait les validateurs entre eux.
- Pour repartir d'un réseau neuf volontairement : supprimer manuellement `genesis.json` et le contenu de `services/nodes/node-1..4/data/`, puis relancer le script (implique aussi de redéployer le contrat et de mettre à jour `CONTRACT_ADDRESS`).
- Le script `generate-network.bat` étant spécifique à Windows (utilise `docker run` avec `%cd%`), cette étape est ignorée avec un message explicite sur toute autre plateforme — le reste de l'initialisation (`.env`, répertoires) fonctionne partout où Node.js est disponible.

## 8. Fichiers concernés

| Fichier | Rôle |
|---|---|
| [`.env.example`](../.env.example) | Modèle versionné, sans secret réel — source pour un `.env` neuf |
| `scripts/init-environment.js` | Logique d'initialisation (Node.js, multiplateforme) |
| `scripts/init-environment.bat` | Point d'entrée Windows (`node init-environment.js`) |
| `scripts/generate-network.bat` | Génération du réseau Besu QBFT, appelée par le script si nécessaire |
| `.env` | Généré/complété localement — **ne jamais committer une fois rempli de secrets réels** |
