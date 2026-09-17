# TrustWedge — Réinitialisation des données (base + blockchain)

> Document 11/11 de la documentation projet. Voir [docs/README.md](README.md) pour l'index complet.
> Décrit `scripts/reset-data.js` : remet l'environnement local à un état propre (démo/tests), en conservant uniquement le compte administrateur.

## 1. Ce que fait le script

```bash
node scripts/reset-data.js --yes
```

La blockchain étant **immuable**, il n'existe pas de moyen de "supprimer" un document déjà émis sans repartir d'une chaîne vierge. Le script traite donc les deux couches ensemble :

1. **Arrête** les nœuds Besu, Blockscout et le backend (Postgres, IPFS, Kong et le frontend restent actifs).
2. **Vide la base PostgreSQL** : `documents`, `workflows`, `workflow_steps`, `invitations`, `document_shares`, `kyc_verifications`, `notifications` sont entièrement vidées ; dans `users`, **seuls le(s) compte(s) avec le rôle `ADMIN` sont conservés** — tout le reste est supprimé.
3. **Efface les données Besu** (`genesis.json`, clés des 4 nœuds) et les **données Blockscout** (base d'indexation).
4. **Régénère un réseau Besu QBFT neuf** (`scripts/generate-network.bat`) et redémarre les 4 nœuds.
5. **Redéploie le contrat `DocumentRegistry`** (Hardhat) — la nouvelle `CONTRACT_ADDRESS` est écrite automatiquement dans `.env` par `scripts/deploy.js`.
6. **Redémarre** le backend et Blockscout (qui réindexe la nouvelle chaîne depuis le bloc 0).

**IPFS et Kong ne sont pas touchés** — les anciens fichiers PDF restent stockés sur IPFS (orphelins, sans conséquence) mais ne sont plus référencés par aucun document.

## 2. Pourquoi le compte admin est préservé et pas les autres

Le compte `ADMIN` n'a **aucune clé privée stockée côté serveur** (`private_key_encrypted` est `null`) et **aucun rôle on-chain propre** : toutes les actions qu'il déclenche (financement de compte, attribution de rôle, émission "pour le compte de" — ex. `POST /admin/land-titles/import`) sont en réalité signées avec la **clé de plateforme** (`PRIVATE_KEY`, `.env`), pas avec une clé appartenant à l'admin (voir [08-SECURITE.md](08-SECURITE.md) §5.3, [07-SERVICES.md](07-SERVICES.md) §10). Conséquence pratique : **redéployer le contrat ne casse rien pour l'admin** — la clé de plateforme reçoit automatiquement les rôles nécessaires (`ISSUER_ROLE`, `VERIFIER_ROLE`, `NOTARY_ROLE`, `ADMIN_ROLE`) dès le déploiement (`services/nodes/scripts/deploy.js`), sans étape manuelle.

Ce n'est **pas** le cas des autres comptes (émetteurs, vérificateurs, notaires, citoyens...) : ceux-ci ont une clé privée propre chiffrée en base et un rôle on-chain qui leur a été attribué individuellement sur l'**ancien** contrat. Une fois le contrat redéployé à une nouvelle adresse, ces rôles n'existent plus et ces comptes n'ont plus de solde ETH sur la chaîne neuve — les conserver en base donnerait l'illusion de comptes fonctionnels alors qu'ils ne pourraient plus signer aucune transaction valide. C'est pourquoi ils sont supprimés plutôt que conservés dans un état cassé.

## 3. Pourquoi le contrat est un ordinaire de la plateforme, pas de PRIVATE_KEY

Le fichier `config/qbftConfigFile.json` régénéré par `generate-network.bat` préaffecte tout le solde de test à une adresse fixe (`fe3b557e8fb62b89f4916b721be55ceb828dbd73`), qui correspond exactement à l'adresse dérivée de `PRIVATE_KEY` dans `.env`. Tant que `PRIVATE_KEY` n'est pas changée, chaque réinitialisation du réseau recrée automatiquement ce même compte préfinancé — aucune étape manuelle de financement n'est donc nécessaire après un reset.

## 4. Utilisation

```bash
# Depuis la racine du projet, stack déjà démarrée (docker compose up -d)
node scripts/reset-data.js --yes
```

Sans `--yes`, le script affiche uniquement le résumé de ce qu'il va faire puis s'arrête — c'est le comportement par défaut, pour éviter une exécution accidentelle.

Durée typique : quelques minutes (régénération du réseau + attente que `besu-node-1` soit sain + redéploiement du contrat).

### Après exécution

- Se reconnecter avec le compte admin (même email qu'avant — voir `.env`, `ADMIN_EMAIL`).
- Les comptes de démo (université, entreprise, banque, notaire, citoyens...) doivent être **recréés** (`POST /admin/actors/create` ou `POST /auth/register`) — voir [06-GUIDE-UTILISATION.md](06-GUIDE-UTILISATION.md).
- Vérifier l'état : `docker compose ps`, `curl http://localhost:8000/api/health`.
- Blockscout peut mettre quelques instants à rattraper l'indexation de la nouvelle chaîne après son redémarrage.

## 5. Ce qui N'EST PAS remis à zéro

| Donnée | Conservée ? | Pourquoi |
|---|---|---|
| Compte(s) `role=ADMIN` en base | Oui | Rôle applicatif, pas de dépendance à la clé de plateforme ni à un rôle on-chain propre (§2) |
| `PRIVATE_KEY` (clé de plateforme) | Oui, inchangée | Reçoit automatiquement les rôles nécessaires à chaque déploiement (§3) — la régénérer romprait ce mécanisme |
| `ENCRYPTION_KEY`, `JWT_SECRET`, autres secrets `.env` | Oui, inchangés | Le reset porte sur les *données*, pas sur la configuration de l'environnement — voir [10-INITIALISATION-ENVIRONNEMENT.md](10-INITIALISATION-ENVIRONNEMENT.md) pour la rotation des secrets |
| Fichiers IPFS déjà uploadés | Oui (orphelins) | Hors périmètre du reset (voir §1) — sans conséquence, simplement non référencés |
| Configuration Kong (routes, CORS, rate limiting) | Oui | Non concernée par un reset de données applicatives |

## 6. Variante — reset ponctuel sans script réutilisable

Pour un nettoyage one-shot sans repasser par le script (ex. environnement non standard), les étapes clés peuvent être rejouées manuellement dans l'ordre du §1, notamment le nettoyage SQL :

```sql
BEGIN;
TRUNCATE workflow_steps, workflows, invitations, document_shares, kyc_verifications, notifications, documents
  RESTART IDENTITY CASCADE;
UPDATE users SET created_by = NULL WHERE role <> 'ADMIN';
DELETE FROM users WHERE role <> 'ADMIN';
COMMIT;
```

La partie blockchain (effacement + régénération + redéploiement) reste, elle, indissociable des étapes 3 à 5 du script — il n'existe pas de raccourci plus simple compte tenu de l'immuabilité de la chaîne.
