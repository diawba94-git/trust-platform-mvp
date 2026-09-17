# Documentation TrustWedge — index

Documents séparés par thématique, générés à partir de l'état réel du code (`services/`, `apps/`, `docker-compose.yml`) au 2026-09-04.

| # | Document | Contenu |
|---|---|---|
| 1 | [01-SPECIFICATIONS.md](01-SPECIFICATIONS.md) | Spécifications fonctionnelles et techniques : périmètre, acteurs, exigences, résumé du modèle de données, endpoints, limitations connues, glossaire |
| 2 | [02-ARCHITECTURE.md](02-ARCHITECTURE.md) | Architecture technique : composants Docker Compose, réseau Besu/QBFT, smart contracts, backend, base de données, IPFS, Kong, frontend, wallet mobile, diagrammes de séquence |
| 3 | [03-WORKFLOW.md](03-WORKFLOW.md) | Workflow métier : cycle de confiance complet, machine à états des workflows, les 5 types de workflow, parcours KYC |
| 4 | [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md) | Initialisation pour la mise en production : checklist sécurité, domaine/TLS, infrastructure, variables d'environnement, conformité données |
| 5 | [05-BUSINESS-PLAN.md](05-BUSINESS-PLAN.md) | Business plan pour présentation : problème, solution, marché, modèle économique, feuille de route, risques |
| 6 | [06-GUIDE-UTILISATION.md](06-GUIDE-UTILISATION.md) | Guide d'utilisation : prise en main, guide par rôle (5 tableaux de bord), wallet mobile, dépannage |
| 7 | [07-SERVICES.md](07-SERVICES.md) | Description détaillée de chaque service Docker Compose (11 conteneurs), des modules internes du backend et des applications clientes |
| 8 | [08-SECURITE.md](08-SECURITE.md) | Sécurité : outils et techniques cryptographiques par couche (réseau, authentification, identité/clés, blockchain), ce qui est réel vs. mocké (KYC) |
| 9 | [09-SPECIFICATION-TECHNIQUE-DONNEES.md](09-SPECIFICATION-TECHNIQUE-DONNEES.md) | Spécification technique des données : schéma PostgreSQL colonne par colonne, structures on-chain du contrat, schémas de requête/réponse de l'API |
| 10 | [10-INITIALISATION-ENVIRONNEMENT.md](10-INITIALISATION-ENVIRONNEMENT.md) | Script `scripts/init-environment.js` : génération automatique du `.env` (secrets) et du réseau Besu, usage, rotation des secrets |
| 11 | [11-RESET-DONNEES.md](11-RESET-DONNEES.md) | Script `scripts/reset-data.js` : réinitialisation de la base et de la blockchain en conservant uniquement le compte admin |

## Documents complémentaires existants

- [ParcoursAlice.html](ParcoursAlice.html) — guide pas-à-pas illustré, écran par écran, du cycle de confiance complet
- [WALLET.md](WALLET.md) — configuration technique du wallet mobile (Expo/React Native)
- [../README.md](../README.md) — démarrage rapide, commandes de test, comptes de démo

## Notes

- Les documents 1 à 4 et 6 à 10 sont ancrés dans le code existant (routes, modèles, contrat, docker-compose) — à tenir à jour à mesure que le code évolue.
- Le document 5 (business plan) contient des sections **[À compléter]** marquant les données (chiffrage marché, financier, équipe) qui doivent venir du porteur de projet et non être inventées.
- Le document 8 (sécurité) distingue explicitement les mécanismes **réellement implémentés** de ceux **mockés en démo** (notamment le KYC) — à consulter avant toute présentation externe pour ne pas présenter une brique mockée comme opérationnelle.
