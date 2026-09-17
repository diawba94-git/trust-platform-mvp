# TrustWedge — Initialisation pour la mise en production

> Document 4/6 de la documentation projet. Voir [docs/README.md](README.md) pour l'index complet.
> Ce document part de l'état actuel (MVP local, Docker Compose, un seul hôte) et liste ce qu'il faut faire, dans l'ordre, avant une exposition réelle (utilisateurs externes, données réelles).

## 0. État actuel vs. cible

| | MVP actuel | Cible production |
|---|---|---|
| Hébergement | Poste local (Docker Desktop, Windows) | Serveur(s) dédié(s) ou cloud, joignables publiquement |
| Domaine | `localhost` / `*.localhost` | Nom de domaine réel + DNS |
| TLS | Certificat auto-signé (Kong "snake oil") | Certificat valide (Let's Encrypt ou CA) |
| Secrets | Valeurs d'exemple committées dans `.env` | Secrets régénérés, hors dépôt, gérés via un coffre-fort |
| Authentification | Mot de passe non vérifié | Vérification de mot de passe effective |
| Signature on-chain | Clé de plateforme unique pour plusieurs rôles | À évaluer (séparation par utilisateur ou justification documentée) |
| Sauvegardes | Aucune (volumes locaux) | Sauvegardes régulières Postgres/IPFS/données Besu |
| Supervision | Aucune | Logs centralisés, alerting, dashboard santé réseau |

## 1. Checklist de sécurité — bloquant avant toute mise en production

Ces points sont documentés comme dette assumée du MVP dans le [README](../README.md) (§ Sécurité) et [01-SPECIFICATIONS.md](01-SPECIFICATIONS.md) §7. **Aucun ne doit rester ouvert avant d'exposer la plateforme à de vrais utilisateurs ou de vraies données.**

- [ ] **Implémenter la vérification du mot de passe** dans `POST /auth/login` (`services/backend/app/auth.py`) — `get_password_hash`/`verify_password` existent déjà, il ne reste qu'à les brancher dans `login_user` et à s'assurer que `register_user` stocke bien le hash.
- [ ] **Décider du modèle de signature on-chain par utilisateur** : soit chaque rôle institutionnel obtient sa propre clé/wallet (cohérent avec ce qui existe déjà pour `ISSUER`, cf. `did_service.get_private_key`), soit la clé de plateforme mutualisée est documentée et son risque accepté formellement (un seul point de compromission signe pour plusieurs rôles).
- [ ] **Régénérer tous les secrets** avant tout déploiement non local : `JWT_SECRET`, `ADMIN_PASSWORD`, mot de passe Postgres, `PRIVATE_KEY`, `ENCRYPTION_KEY`, `SECRET_KEY`, `KONG_PG_PASSWORD`, `BLOCKSCOUT_SECRET_KEY_BASE`. Les valeurs actuelles dans `.env` sont des exemples de démo, jamais destinées à un usage réel. `node scripts/init-environment.js` génère ces valeurs automatiquement pour un `.env` neuf (voir [10-INITIALISATION-ENVIRONNEMENT.md](10-INITIALISATION-ENVIRONNEMENT.md)) ; pour un environnement existant, effacer la valeur à régénérer avant de relancer le script (§6 de ce même document pour les précautions, notamment sur `ENCRYPTION_KEY`).
- [ ] **Restreindre le CORS** côté FastAPI (`allow_origins=["*"]` dans `main.py`) au(x) domaine(s) réel(s) du frontend/wallet.
- [ ] **Remplacer le certificat TLS auto-signé de Kong** par un certificat valide (Let's Encrypt ou CA d'entreprise) dès qu'un nom de domaine réel est disponible.
- [ ] **Ne jamais publier l'Admin API Kong (8001) ni Kong Manager (8002)** vers l'extérieur — rester sur l'accès `docker exec` documenté.
- [ ] **Vérifier qu'aucun fichier `.env` réel n'est commité** dans un dépôt Git partagé (le `.env` actuel du repo local contient des secrets de démo — à traiter comme sensible dès qu'il contiendra de vraies valeurs).

## 2. Étapes d'initialisation réseau et domaine

1. **Réserver un nom de domaine** et le pointer vers l'IP publique de l'hôte de production (ou, à défaut, voir §2bis pour un déploiement par IP nue).
2. **Régénérer un réseau Besu QBFT dédié à la production** avec `scripts/generate-network.bat` (ou son équivalent) — ne jamais réutiliser les clés de validateurs générées pour le développement local.
3. **Redéployer les smart contracts** sur ce nouveau réseau (`services/nodes/scripts/deploy.js` via Hardhat), puis mettre à jour `CONTRACT_ADDRESS` dans `.env` et redémarrer le backend.
4. **Régler `DEPLOY_HOST`** (`.env`) sur le domaine réel (ex. `trustwedge.example.com`) et relancer `docker compose up -d kong-setup` — met à jour automatiquement les origines CORS de Kong et enregistre les routes `explorer.<DEPLOY_HOST>` / `explorer-api.<DEPLOY_HOST>` de Blockscout (voir §2bis pour le détail du mécanisme). `REACT_APP_API_URL`/`REACT_APP_WS_URL` restent des URLs **relatives** — aucune modification nécessaire de ce côté (voir §2bis).
5. **Émettre/installer le certificat TLS** pour ce domaine (port 8443 ou 443 selon la configuration retenue en façade — reverse proxy externe optionnel devant Kong).

## 2bis. Déploiement par IP nue, sans nom de domaine

Cas fréquent pour un pilote interne (LAN, serveur avec IP fixe mais pas encore de domaine).

### En bref — dans quel(s) fichier(s) mettre l'IP

| Fichier | Variable | Obligatoire ? |
|---|---|---|
| `.env` (racine) | `DEPLOY_HOST=192.168.1.50` | Oui — pilote le CORS Kong et les routes Blockscout |
| `apps/wallet/.env.local` (à créer depuis `apps/wallet/.env.example`) | `TRUSTWEDGE_API_URL=http://192.168.1.50:8000/api` | Seulement si le wallet mobile est déployé/testé |

Après avoir réglé `.env`, appliquer avec :
```bash
docker compose up -d kong-setup
```
Rien d'autre à modifier : `REACT_APP_API_URL`/`REACT_APP_WS_URL` (frontend web) sont des URLs **relatives**, donc déjà indépendantes de l'IP — voir détail ci-dessous.

**Ce qui fonctionne sans rien faire d'autre :**
- **Frontend web + API** : `REACT_APP_API_URL=/api` et `REACT_APP_WS_URL` sont des URLs relatives / construites depuis `window.location` — le navigateur appelle naturellement la bonne IP, qu'on accède à `http://localhost:8000` ou `http://192.168.1.50:8000`. Aucune variable à changer, aucun rebuild.
- **CORS Kong** : `DEPLOY_HOST` ajoute automatiquement `http://<DEPLOY_HOST>:8000` et `https://<DEPLOY_HOST>:8443` aux origines autorisées (`scripts/kong-setup.sh`) — utile pour un futur client cross-origin, sans effet sur l'usage normal (même origine, jamais soumis au CORS).
- **RPC Besu** (`127.0.0.1:8645`) : reste volontairement en loopback (déploiement Hardhat uniquement) — aucun code client (web) n'en dépend.

**Ce qui nécessite une action manuelle : Blockscout (l'explorateur).**
Le routage `explorer.localhost` repose sur la résolution native de `*.localhost` par les navigateurs — un mécanisme qui **n'existe pas** pour une IP brute (`explorer.192.168.1.50` ne se résout par aucun DNS). `DEPLOY_HOST` fait déjà enregistrer les routes Kong correspondantes (`explorer.<DEPLOY_HOST>`, `explorer-api.<DEPLOY_HOST>`) ; il reste à faire pointer ce nom vers le serveur **côté client** :
- Ajouter dans le fichier hosts de chaque poste amené à consulter l'explorateur :
  ```
  192.168.1.50   explorer.192.168.1.50 explorer-api.192.168.1.50
  ```
  (`C:\Windows\System32\drivers\etc\hosts` sous Windows, `/etc/hosts` sous Linux/macOS)
- Alternative pour un public plus large (sans accès aux postes clients) : exposer Blockscout sur des ports dédiés plutôt que par nom d'hôte — non fait par défaut (ajouterait une brèche dans le principe "Kong = point d'entrée unique" pour un service secondaire en lecture seule) ; à évaluer au cas par cas si le besoin se présente.
- Sans cette étape, l'explorateur reste inutilisable depuis l'extérieur mais l'application principale (émission, vérification, workflows) n'est **pas affectée** — Blockscout est un outil d'audit indépendant, pas une dépendance fonctionnelle.

**Wallet mobile** : copier `apps/wallet/.env.example` en `apps/wallet/.env.local` et y régler `TRUSTWEDGE_API_URL` sur l'IP de la machine (un téléphone ne résout pas `localhost`, qui pointerait vers lui-même) ; garder cette valeur alignée avec `DEPLOY_HOST`. Expo ne lit pas `.env` par défaut — voir le commentaire en tête de `.env.example` pour le report vers `app.json` si besoin.

**TLS** : indépendant de IP vs domaine — le certificat auto-signé de Kong déclenchera un avertissement navigateur quel que soit l'hôte utilisé, tant qu'un vrai certificat n'est pas installé (nécessite généralement un domaine pour Let's Encrypt ; une CA interne peut émettre un certificat pour une IP si besoin).

## 3. Infrastructure cible recommandée

- **Hébergement** : VM(s) dédiée(s) avec suffisamment de RAM/CPU pour 11 conteneurs (4 nœuds Besu + Postgres ×2 + IPFS + backend + frontend + Blockscout ×2 + Kong ×3) ; prévoir la marge pour la croissance de la chaîne (les données Besu croissent indéfiniment).
- **Orchestration** : Docker Compose reste viable pour un déploiement mono-hôte maîtrisé ; envisager Kubernetes/Swarm seulement si une haute disponibilité multi-hôte ou un auto-scaling est requis (non nécessaire pour un lancement pilote).
- **Sauvegardes** :
  - PostgreSQL applicatif (`services/postgres-data`) — dump régulier (`pg_dump`), rétention à définir selon la criticité des données (documents officiels).
  - Données IPFS (`services/ipfs-data`) — les fichiers n'existent qu'où ils sont épinglés (pin) ; prévoir un second nœud IPFS ou un service d'épinglage externe pour la résilience.
  - Données des nœuds Besu (`services/nodes/node-*/data`) — la blockchain est la source de vérité légale des documents : sa perte est irréversible, sauvegarde impérative, idéalement répliquée sur plusieurs sites.
  - Base Blockscout — reconstruisible par ré-indexation depuis la chaîne, moins critique en sauvegarde directe.
- **Supervision** :
  - Centraliser les logs des conteneurs (ex. Loki/ELK) plutôt que `docker compose logs` seul.
  - Alerter sur `GET /health` (backend) et `GET /network/status` (santé du réseau Besu — nombre de nœuds up, dernier bloc).
  - Surveiller la latence de mint/vérification on-chain (SLA à définir en fonction du volume attendu).
- **CI/CD** : mettre en place un pipeline qui build les images (`backend`, `frontend`) et exécute au minimum un test de fumée (`/health`, `/documents/verify/{token_id}` connu) avant tout déploiement.

## 4. Variables d'environnement — inventaire (`.env`)

Aucune valeur n'est reproduite ici (fichier sensible) — inventaire des clés à définir en production, avec la recommandation associée :

| Variable | Recommandation production |
|---|---|
| `DEPLOY_HOST` | IP publique/LAN ou domaine réel de la machine — pilote le CORS Kong et les routes Blockscout (voir §2/§2bis) |
| `BESU_NETWORK_ID`, `BESU_CHAIN_ID` | Valeurs dédiées au réseau de production, distinctes du réseau de développement |
| `BESU_RPC_URL`, `BESU_WS_URL` | Interne au réseau Docker/VPC — ne pas exposer publiquement |
| `BESU_GAS_PRICE` | Cohérent avec la configuration QBFT (souvent 0 en réseau privé permissioned) |
| `PRIVATE_KEY` | Clé de signature de plateforme — générer une clé neuve, ne jamais réutiliser celle de dev, stocker dans un coffre-fort (Vault/KMS), jamais en clair sur disque non chiffré |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL` | Mot de passe long et aléatoire, généré par un gestionnaire de secrets |
| `IPFS_API_URL`, `IPFS_GATEWAY_URL` | Interne au réseau Docker/VPC |
| `CONTRACT_ADDRESS` | Mis à jour après chaque redéploiement du contrat sur le réseau de production |
| `BLOCKSCOUT_SECRET_KEY_BASE` | Générer une valeur aléatoire dédiée (ex. `openssl rand -hex 64`) |
| `JWT_SECRET` | Aléatoire, ≥256 bits, rotation planifiée |
| `JWT_ALGORITHM`, `JWT_EXPIRATION` | Conserver un algorithme signé (HS256/RS256), durée d'expiration courte + refresh si besoin |
| `NODE_ENV`, `API_PORT` | `production` |
| `REACT_APP_API_URL`, `REACT_APP_WS_URL`, `REACT_APP_BLOCKCHAIN_RPC` | Domaine réel, en HTTPS/WSS |
| `KONG_PG_PASSWORD` | Aléatoire, dédié à la base Kong |
| `SECRET_KEY` | Aléatoire, dédié |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Compte admin réel — mot de passe fort, à changer dès le premier accès une fois la vérification de mot de passe implémentée (§1) |
| `ENCRYPTION_KEY` | Clé de chiffrement des clés privées utilisateurs (`did_service.py`) — critique, à protéger comme `PRIVATE_KEY` |

Recommandation générale : externaliser ces valeurs d'un gestionnaire de secrets (Vault, AWS/GCP Secret Manager, ou a minima un fichier `.env` chiffré hors dépôt Git) plutôt qu'un fichier `.env` en clair sur le serveur. `node scripts/init-environment.js` (voir [10-INITIALISATION-ENVIRONNEMENT.md](10-INITIALISATION-ENVIRONNEMENT.md)) peut servir de point de départ pour un premier provisionnement (génère des valeurs aléatoires cryptographiquement sûres), mais ne remplace pas un vrai coffre-fort de secrets en production.

## 5. Conformité et protection des données (contexte Sénégal)

TrustWedge traite des données à caractère personnel sensibles (identité, diplômes, situation financière, titres de propriété). Avant toute mise en production réelle :

- Identifier le cadre légal applicable (au Sénégal : loi n°2008-12 sur la protection des données à caractère personnel, sous l'autorité de la CDP — Commission de protection des Données personnelles) et vérifier les obligations de déclaration/autorisation pour un traitement de cette nature.
- Documenter la base légale de chaque traitement (consentement, mission d'intérêt public pour les institutions publiques type foncier/état civil...).
- Définir une politique de conservation/suppression des données personnelles côté base applicative (la blockchain, elle, est par nature immuable — voir point suivant).
- **Point d'architecture à trancher explicitement** : l'immuabilité de la blockchain est un atout pour la non-répudiation, mais entre en tension avec un éventuel droit à l'effacement. À arbitrer avec un conseil juridique avant la mise en production (ex. : ne jamais stocker de donnée personnelle brute on-chain, uniquement des hashs/CID, ce qui est déjà le cas actuellement pour le contenu des fichiers).
- Chiffrement au repos des données sensibles en base (clés privées déjà chiffrées via `ENCRYPTION_KEY` — étendre la revue à toute donnée personnelle stockée en clair côté Postgres).

## 6. Plan de bascule et rollback

1. Déployer la nouvelle version en environnement de pré-production, rejouer le test de bout en bout du [README](../README.md) (§ Tester l'application).
2. Sauvegarder Postgres et les données Besu juste avant bascule.
3. Bascule DNS/reverse proxy vers la nouvelle version.
4. En cas d'anomalie bloquante : les volumes Docker Compose sont conservés par défaut (`docker compose down` sans `-v`) — un retour à la version précédente ne nécessite pas de perte de données applicatives ; la blockchain, elle, ne peut pas être "annulée" — traiter toute anomalie de contrat par une nouvelle version de contrat plutôt qu'un rollback de chaîne.

## 7. Checklist complète — toutes les tâches, dans l'ordre

Récapitulatif actionnable de tout ce document : à suivre dans l'ordre pour obtenir un déploiement fonctionnel et sûr. Chaque tâche renvoie à la section qui la détaille.


## ############################################# DEMARCHE #####################
##   ##########################################################################
1. **Provisionner la machine** (VM ou serveur dédié, RAM/CPU suffisants pour 11 conteneurs) et y installer Docker + Docker Compose (§3).
2. **Générer l'environnement** : `node scripts/init-environment.js` — crée `.env` avec des secrets aléatoires et génère le réseau Besu QBFT (voir [10-INITIALISATION-ENVIRONNEMENT.md](10-INITIALISATION-ENVIRONNEMENT.md)).
3. **Régler `DEPLOY_HOST`** dans `.env` sur l'IP publique/LAN ou le domaine réel de la machine (§2bis).
4. **Réserver un nom de domaine** et le pointer vers cette IP si possible ; sinon rester en IP nue et suivre le §2bis pour Blockscout et le wallet mobile.
5. **Démarrer la stack** : `docker compose up -d --build`.
6. **Déployer les smart contracts** (`services/nodes` : `npm install` puis `npx hardhat run scripts/deploy.js --network besu`) — met à jour `CONTRACT_ADDRESS` dans `.env` automatiquement ; redémarrer le backend ensuite (`docker compose up -d backend`) (§2).
7. **Appliquer la config Kong** : `docker compose up -d kong-setup` — indispensable après toute modification de `DEPLOY_HOST` (§2/§2bis).
8. **Brancher la vérification de mot de passe** dans `POST /auth/login` (`services/backend/app/auth.py`) — bloquant (§1).
9. **Décider du modèle de signature on-chain** par utilisateur (clé propre par rôle institutionnel vs clé de plateforme mutualisée documentée) (§1).
10. **Restreindre le CORS FastAPI** (`allow_origins=["*"]` dans `main.py`) au(x) domaine(s)/IP réel(s) (§1).
11. **Installer un certificat TLS valide** sur Kong (remplace le certificat auto-signé) dès qu'un domaine est disponible (§1/§2bis).
12. **Si IP nue sans domaine** : ajouter les entrées `hosts` côté clients pour l'explorateur Blockscout, et régler `apps/wallet/.env.local` pour le wallet mobile (§2bis).
13. **Vérifier qu'aucun `.env` réel n'est commité** dans un dépôt Git partagé (§1).
14. **Mettre en place les sauvegardes** : PostgreSQL (`pg_dump` régulier), données Besu (`services/nodes/node-*/data` — critique, irréversible en cas de perte), épinglage IPFS (§3).
15. **Mettre en place la supervision** : logs centralisés, alerte sur `GET /api/health` et `GET /api/network/status` (§3).
16. **Mettre en place un pipeline CI/CD** avec au moins un test de fumée avant tout déploiement (§3).
17. **Revue de conformité données personnelles** (loi sénégalaise n°2008-12, CDP) avant onboarding de vrais utilisateurs (§5).
18. **Tester le cycle complet de bout en bout** (voir [README](../README.md) § Tester l'application) en pré-production avant bascule (§6).
19. **Documenter le plan de bascule/rollback** propre à cet environnement (§6).

Les tâches 8 à 11 et 13 forment la checklist de sécurité détaillée en §1 — **aucune ne doit rester ouverte** avant d'exposer la plateforme à de vrais utilisateurs ou de vraies données.
