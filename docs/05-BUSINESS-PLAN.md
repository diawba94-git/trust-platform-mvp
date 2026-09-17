# TrustWedge — Business plan (support de présentation)

> Document 5/6 de la documentation projet. Voir [docs/README.md](README.md) pour l'index complet.
>
> **Note méthodologique** : ce document structure l'argumentaire à partir de ce que la plateforme fait réellement aujourd'hui (voir [01-SPECIFICATIONS.md](01-SPECIFICATIONS.md) et [02-ARCHITECTURE.md](02-ARCHITECTURE.md)). Les champs marqués **[À compléter]** appellent des données que seul le porteur de projet peut fournir (chiffrage marché, hypothèses financières, équipe, calendrier de levée) — ils ne doivent pas être remplis par des estimations inventées avant présentation à des tiers (investisseurs, partenaires institutionnels).

## 1. Résumé exécutif

TrustWedge est une plateforme de sécurisation et de vérification de documents officiels — diplômes, attestations d'emploi, titres fonciers, cartes d'identité, actes de naissance, attestations de résidence — fondée sur une blockchain privée, un stockage de fichiers décentralisé (IPFS) et une identité numérique auto-souveraine (DID). Elle permet à plusieurs institutions qui ne se font pas mutuellement confiance a priori — université, entreprise, banque, notaire, administration — de vérifier instantanément et sans intermédiaire l'authenticité d'un document, tout en donnant au citoyen le contrôle de ses propres attestations via un wallet mobile.

Le MVP actuel démontre un cycle de confiance complet et fonctionnel : émission d'un diplôme → vérification par un employeur → attestation d'emploi → dossier de prêt bancaire → transfert de titre foncier à triple signature (vendeur / acheteur / notaire) — chaque étape étant vérifiable indépendamment sur la blockchain. Chaque certificat émis embarque désormais un QR code de vérification, et un document déposé (PDF/photo) est authentifié automatiquement — sans ressaisie d'identifiant — par son empreinte de contenu, avec détection prouvée de toute falsification, même d'un seul octet (voir [scripts/test_land_title_tampering.js](../scripts/test_land_title_tampering.js)).

## 2. Le problème

Dans le contexte sénégalais et plus largement ouest-africain, la vérification de documents officiels reste largement manuelle, lente et vulnérable à la fraude :

- **Faux diplômes et attestations** : les employeurs et administrations n'ont souvent d'autre choix que d'appeler l'institution émettrice ou d'accepter le document tel quel, sans moyen de vérification indépendant et rapide.
- **Titres fonciers contestés ou dupliqués** : l'absence de registre numérique infalsifiable et consultable facilite les doubles ventes et les litiges de propriété.
- **Lenteur des dossiers de prêt** : la vérification de l'emploi et des attestations associées ralentit l'instruction bancaire.
- **Dépendance à la disponibilité de l'émetteur** : un document papier perdu, ou une institution injoignable, bloque toute vérification.
- **Absence de contrôle du citoyen sur ses propres documents** : pas de moyen simple de partager une preuve vérifiable sans transmettre le document complet (et ses données associées).

**[À compléter]** — chiffrage de l'ampleur du problème (taux de fraude documentaire estimé, délai moyen de vérification actuel, volume annuel de diplômes/titres émis au Sénégal, etc.), à sourcer auprès d'organismes officiels avant utilisation en présentation.

## 3. La solution TrustWedge

| Besoin | Réponse TrustWedge |
|---|---|
| Vérifier un document sans dépendre de l'émetteur | Vérification on-chain publique et instantanée (`GET /documents/verify/{token_id}`), indépendante de la disponibilité de qui que ce soit |
| Vérifier sans même connaître l'identifiant du document | Dépôt du fichier (PDF/photo) ou scan du QR imprimé sur le certificat : le document est retrouvé et authentifié automatiquement par son empreinte de contenu |
| Empêcher la falsification | Document = NFT sur blockchain privée QBFT + fichier adressé par son hash (IPFS/CID) — toute altération, même d'un seul octet, change le hash et invalide la correspondance (détection démontrée par test automatisé) |
| Éviter les doublons / doubles émissions | Unicité imposée on-chain par référence métier **et** par contenu (voir [02-ARCHITECTURE.md](02-ARCHITECTURE.md) §3.1) |
| Historiser sans perdre la traçabilité | Versionnement on-chain (`DocumentVersion[]`), propriété consultable à une date donnée, historique affiché du plus récent au plus ancien |
| Sécuriser un transfert de titre (foncier) | Mécanisme à triple signature (vendeur / acheteur / notaire) vérifié cryptographiquement on-chain |
| Protéger l'acheteur d'un bien foncier avant l'achat | Un citoyen intéressé par un titre foncier peut en demander la vérification directement au vendeur ou à un tiers, **avant** tout engagement — dissuade les doubles ventes et les titres contestés, sans attendre l'intervention d'un notaire |
| Solliciter le bon acteur pour chaque type de document | Demande de vérification dirigée vers l'acteur institutionnel pertinent (ou recherche par nom/CNI pour un titre foncier impliquant un autre citoyen, ex. un acheteur potentiel) |
| Donner au citoyen le contrôle de ses documents | Wallet mobile, partage sélectif à durée de vie limitée et révocable, sans exposer l'ensemble du document |
| Rassurer sans exposer l'infrastructure interne | Explorateur de blocs public (Blockscout) permettant un audit indépendant, sans faire confiance à l'opérateur de la plateforme |

## 4. Marché cible et segments

- **Institutions émettrices** : universités et établissements de formation (diplômes), employeurs (attestations d'emploi), administrations (titres fonciers, état civil).
- **Institutions vérificatrices** : entreprises (recrutement), banques et institutions de microfinance (instruction de prêt), notaires (transferts de propriété).
- **Utilisateurs finaux** : citoyens détenteurs de documents, via le wallet mobile — y compris comme **acheteurs potentiels** vérifiant un titre foncier avant de s'engager, sans attendre l'intervention d'une institution.

Segment de lancement recommandé (cohérent avec le MVP déjà couvert) : un trio pilote **université + banque/institution de microfinance + notaire**, permettant de démontrer le cycle complet diplôme → emploi → prêt sur un périmètre restreint et mesurable avant extension au foncier à plus grande échelle.

**[À compléter]** — taille de marché (nombre d'universités/banques/notaires adressables au Sénégal et zone UEMOA, budget IT typique de ces institutions), à documenter avant présentation à des investisseurs.

## 5. Modèle économique (pistes)

Plusieurs modèles sont compatibles avec l'architecture actuelle, à arbitrer selon le positionnement retenu (opérateur privé vs. infrastructure publique) :

- **Abonnement par institution émettrice** (SaaS) — accès à l'émission illimitée ou par palier de volume.
- **Frais à la vérification** pour les institutions vérificatrices tierces (entreprises, banques) — modèle « pay per check ».
- **Marque blanche pour un opérateur public** — l'État ou une agence dédiée opère la plateforme comme infrastructure nationale, TrustWedge fournissant la technologie et l'intégration.
- **Frais de transaction sur les transferts fonciers** — captation de valeur sur un acte à forte valeur unitaire (vente immobilière), en marge des frais notariaux existants plutôt qu'en remplacement.

**[À compléter]** — grille tarifaire, hypothèses de volume, projections de revenus. Ces éléments dépendent de décisions commerciales (positionnement B2B vs. B2G) qui restent à trancher par le porteur de projet.

## 6. Avantage concurrentiel

- **Cycle multi-acteurs déjà implémenté de bout en bout** (pas seulement un registre de documents isolé) : émission, vérification, workflow inter-institutions, transfert à signature multiple — voir [03-WORKFLOW.md](03-WORKFLOW.md).
- **Standards ouverts** : DID (`did:ethr`), architecture proche des Verifiable Credentials — évite le verrouillage propriétaire et facilite une future interopérabilité.
- **Blockchain privée permissioned (QBFT)**, adaptée à un contexte institutionnel : les validateurs peuvent être répartis entre les institutions partenaires (université, banque, notaire, État) plutôt que confiés à un opérateur unique — un argument de gouvernance partagée à mettre en avant face à des institutions qui hésiteraient à confier leurs données à une blockchain publique ou à un unique opérateur privé.
- **Auditabilité indépendante** via l'explorateur de blocs public, sans nécessiter de faire confiance à l'opérateur de la plateforme.
- **Protection de l'acheteur avant l'achat** : un citoyen peut vérifier l'authenticité d'un titre foncier directement auprès du vendeur avant de s'engager financièrement — un usage à forte valeur perçue pour l'adoption citoyenne, au-delà du seul cercle des institutions.

## 7. Feuille de route produit

| Horizon | Étape | Prérequis |
|---|---|---|
| Actuel | MVP fonctionnel, démonstrable (6 rôles, 6 types de documents couverts — diplôme, emploi, titre foncier, CNI, acte de naissance, attestation de résidence —, cycle complet, wallet mobile, QR + vérification automatique par fichier) | — |
| Court terme | Mise en production sécurisée (voir [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md)) | Correction des limitations de sécurité du MVP |
| Court/moyen terme | Pilote avec 1 université + 1 banque/IMF + 1 notaire | Accord(s) partenaire(s), domaine + infrastructure de production |
| Moyen terme | Extension foncier à l'échelle (cadastre numérique partiel) | Cadre juridique clarifié avec les autorités foncières |
| Moyen/long terme | Ouverture à d'autres types de documents professionnels/sectoriels (permis de conduire, certificats professionnels, diplômes étrangers) | Généricité déjà permise par le contrat `DocumentRegistry` (mutualisé par conception) — 6 types déjà couverts aujourd'hui |
| Long terme | Gouvernance partagée du réseau de validateurs entre institutions partenaires | Cadre contractuel/juridique de gouvernance multi-partie |

## 8. Go-to-market (piste de démarrage)

1. Identifier 1 à 3 institutions pilotes par catégorie (émetteur, vérificateur, notaire) prêtes à un test grandeur réelle limité.
2. Démonstration guidée à partir du parcours existant ([ParcoursAlice.html](ParcoursAlice.html)) plutôt qu'un discours purement technique.
3. Mesurer sur le pilote : temps de vérification (avant/après), taux d'adoption côté citoyens (wallet), incidents de sécurité.
4. Utiliser les résultats du pilote comme preuve de traction pour l'extension à d'autres institutions et, le cas échéant, une levée de fonds.

## 9. Risques et mitigations

| Risque | Mitigation |
|---|---|
| Résistance au changement des institutions (papier → numérique) | Démarrage pilote à faible risque, coexistence avec les processus existants pendant la transition |
| Cadre juridique de la preuve numérique encore incertain localement | Engager le dialogue avec les autorités compétentes en amont du pilote (voir [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md) §5) |
| Dépendance à la connectivité Internet pour la vérification | Le design actuel suppose un accès réseau ; une réflexion sur un mode de vérification partiellement hors-ligne (vérification de signature locale) pourrait être envisagée à terme |
| Sécurité (dette technique du MVP) | Corrections prioritaires listées en [04-DEPLOIEMENT-PRODUCTION.md](04-DEPLOIEMENT-PRODUCTION.md) §1, à traiter avant toute donnée réelle |
| Gouvernance du réseau de validateurs en cas de désaccord entre institutions partenaires | Définir contractuellement en amont les règles de gouvernance et de sortie du réseau |

## 10. Besoins de financement et équipe

**[À compléter]** — montant recherché, utilisation des fonds, jalons associés, composition de l'équipe fondatrice et rôles. Ces informations sont propres au porteur de projet et ne doivent pas être estimées à sa place.

## 11. Argumentaire de présentation (structure suggérée pour un pitch)

1. Le problème, en une scène concrète (ex. : une entreprise qui ne peut pas vérifier un diplôme rapidement).
2. La démonstration du cycle complet Alice — diplôme → emploi → prêt → foncier — comme preuve de concept vivante plutôt qu'un slide.
3. Ce qui rend la fraude impossible (unicité on-chain, hash de contenu, historique immuable).
4. Le modèle de gouvernance partagée entre institutions (différenciateur face à une solution centralisée classique).
5. La feuille de route de mise en production et le plan pilote (§7-8).
6. L'appel à l'action (partenariat pilote, financement — selon l'audience).
