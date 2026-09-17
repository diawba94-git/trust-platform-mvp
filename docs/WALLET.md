# TrustWedge Wallet — wallet mobile

Wallet React Native (Expo) permettant à un propriétaire de document (Jean, Alice, ...) de
garder ses attestations TrustWedge sur son téléphone, de les partager par QR code, et de
vérifier l'authenticité d'un document tiers en scannant son QR.

## Structure ajoutée au monorepo

```
trustwedge/
├── apps/
│   └── wallet/            # App React Native (Expo)
├── packages/
│   ├── shared/             # Types TypeScript partagés (miroir des schémas backend)
│   └── sdk/                 # Client API REST + client blockchain (ethers.js) + QR
├── package.json             # Workspaces npm ("apps/*", "packages/*")
└── services/                 # Inchangé — backend/frontend/nodes restent buildés par Docker
```

`services/*` reste hors du workspace npm (chaque service a son propre `package.json`, buildé
indépendamment par Docker) — seuls `apps/*` et `packages/*` sont de nouveaux workspaces npm.

## Décisions d'architecture importantes

### 1. D'où vient le DID du wallet ? Deux chemins, au choix sur l'écran d'accueil

Le cahier des charges demandait à la fois "créer un DID à la première installation" et
"utiliser les DID existants de TrustWedge" via `GET /did/my`. Les deux existent, comme deux
boutons sur `OnboardingScreen` :

- **"Se connecter à mon compte TrustWedge"** (`authService.linkExistingAccount`) — pour un
  propriétaire dont le compte a déjà été créé par un admin/émetteur (comme aujourd'hui). Le
  wallet se connecte une fois avec l'email/mot de passe, récupère le DID + la clé privée déjà
  générés côté serveur via `GET /did/my`, puis les enferme dans le Keychain/Keystore. La clé
  privée ne quitte alors plus jamais l'appareil.
- **"Je n'ai pas de compte — créer mon DID"** (`authService.registerNewAccount`) — pour
  quelqu'un sans aucun compte préexistant : typiquement un **acheteur** qui veut simplement
  pouvoir vérifier un titre avant achat, et recevoir le sien une fois la vente conclue, sans
  qu'un admin n'ait dû le créer à l'avance. Le wallet génère la paire de clés **sur
  l'appareil** (`cryptoService.generatePrivateKeyHex`, via `expo-crypto` — pas
  `ethers.Wallet.createRandom()`, qui dépend d'un polyfill natif incompatible Expo Go) et
  n'envoie que l'adresse publique au serveur, via `POST /auth/register` (public, n'exige
  aucun rôle admin — et accepte déjà une adresse fournie par l'appelant, donc aucun
  changement backend n'a été nécessaire). Le backend ne détient à aucun moment cette clé
  privée : c'est le chemin réellement auto-souverain, plus proche de "créer un DID" au sens
  strict que l'import ci-dessus.

Ce DID auto-généré fonctionne normalement pour recevoir et vérifier des documents — le
contrat n'exige pas que `owner` corresponde à un compte préexistant — mais n'a aucun rôle
on-chain particulier (ISSUER/VERIFIER/NOTARY) : il peut seulement posséder et vérifier, pas
émettre. C'est cohérent avec un acheteur/particulier, pas un émetteur institutionnel.

⚠️ Limite héritée du backend, pas introduite par le wallet : `POST /auth/login` ne vérifie
actuellement pas le mot de passe (`auth.py::login_user`, commentaire "pas de mot de passe
dans la base pour le MVP" — le modèle `User` n'a même pas de colonne pour ça). Le mot de
passe demandé par `RegisterScreen` est donc, pour l'instant, décoratif — à corriger côté
backend avant toute mise en production, indépendamment du wallet.

### 2. Vérification : toujours en direct, jamais depuis le QR

Le QR généré (`packages/sdk/src/qr.ts`) ne contient que de quoi retrouver le document
(`tokenId` en premier lieu) — jamais un verdict. Chaque scan redemande
`GET /documents/verify/{tokenId}` (public, sans authentification, lu on-chain côté backend).
Un QR copié pour un document révoqué depuis affichera donc bien "invalide" : le wallet ne
fait jamais confiance aux données qu'il a lui-même émises.

### 3. Lecture blockchain directe (ethers.js) vs API backend

`packages/sdk/src/contractClient.ts` fournit un client de lecture directe sur
`DocumentRegistry.sol` via JSON-RPC, comme demandé ("packages/sdk : client blockchain").
**Il n'est pas utilisé par défaut dans le wallet** : dans `docker-compose.yml`, le RPC Besu
(`besu-node-4`, port 8645) n'est publié qu'en loopback (`127.0.0.1:8645`), volontairement, pour
ne pas exposer le RPC au réseau. Un téléphone sur le même LAN ne peut donc pas l'atteindre. Le
wallet passe donc par `TrustWedgeApiClient.verifyDocument()` (backend, via Kong, déjà public
pour cette route) — qui lit exactement les mêmes données on-chain. `contractClient.ts` reste
disponible pour un usage desktop/CI, ou le jour où une route RPC en lecture seule est exposée
délibérément via Kong (changement d'infra volontaire, pas fait ici).

### 4. Bibliothèques : équivalents Expo Go plutôt que la liste demandée telle quelle

Trois bibliothèques demandées contiennent du code natif custom (`react-native-keychain`,
`react-native-encrypted-storage`, `react-native-biometrics`) : elles imposent de compiler un
dev client (voir l'appendice "Aller plus loin" en fin de document), impossible à tester en
scannant juste un QR code avec l'app Expo Go. Pour permettre un test immédiat, elles sont
remplacées par leurs équivalents 100 % Expo SDK, qui s'appuient sur le même stockage sécurisé
du système (Keychain iOS / Keystore Android) :

| Demandé | Utilisé | Pourquoi |
|---|---|---|
| `react-native-keychain` | `expo-secure-store` | Compatible Expo Go, adossé au même Keychain/Keystore |
| `react-native-encrypted-storage` | `@react-native-async-storage/async-storage` | Compatible Expo Go ; le contenu reste chiffré AES-256 au niveau applicatif (`cryptoService.ts`), donc pas de régression de confidentialité pour les données qu'on y met |
| `react-native-biometrics` | `expo-local-authentication` | Compatible Expo Go, même fonction (prompt biométrique) |
| `react-native-camera` | `expo-camera` | `react-native-camera` est archivé/non maintenu, de toute façon incompatible avec Expo |

`react-native-qrcode-svg`, `ethers`, `axios` sont utilisés tels que demandés.

Ce choix est documenté comme réversible : `keyService.ts`, `pinService.ts`,
`sessionService.ts`, `storageService.ts` et `biometricService.ts` exposent tous la même
interface qu'avant — repasser sur les libs natives (pour un build de production plus proche
du cahier des charges initial) ne touche que l'intérieur de ces 5 fichiers.

### 5. Notifications

Pas d'infrastructure push (APNs/FCM) côté backend — en ajouter une est un chantier backend à
part entière, hors périmètre ici. `notificationService.ts` déclenche des notifications
**locales** (via `expo-notifications`) à chaque resynchronisation (ouverture de l'app,
pull-to-refresh) quand un nouveau `tokenId` apparaît dans `GET /documents/my`.

## Onboarding SSI (KYC) — uniquement à la création d'un nouveau DID

`RegisterScreen` → `KycVerificationScreen` (4 étapes) → `SetupPin`. Ne concerne **que** le
parcours "Je n'ai pas de compte — créer mon DID" (`WalletContext.needsKyc`) — un compte
importé via `linkAccount` (`GET /did/my`) est déjà considéré provisionné par un admin et saute
cette étape.

Nouvelles routes backend, publiques (avant tout JWT), sous `services/backend/app/routers/verification.py` :

| Route | Réel | Mocké |
|---|---|---|
| `POST /verification/phone/send`, `/phone/verify` | Logique du code (JWT signé, expiration 5 min, hash du code) | Envoi SMS (Twilio) — le code est loggé côté serveur (`docker compose logs backend`) et renvoyé au client dans `dev_code` (à retirer avant toute mise en prod) |
| `POST /verification/email/send`, `/email/verify` | Logique du lien (JWT signé, expiration 24h) | Envoi email (SMTP) — le lien est loggé côté serveur |
| `POST /verification/id-card/extract` | **Entièrement réel** — réutilise `pytesseract`/`tesseract-ocr-fra`, déjà présents dans le Dockerfile backend pour l'OCR des titres fonciers (`services/id_card_ocr_service.py`, mêmes regex best-effort que `ocr_service.extract_land_title_fields`) | — |
| `POST /verification/face/compare` | — | Reconnaissance faciale (`services/face_match_service.py`) : aucune dépendance de ce type installée (dlib/face_recognition, ou service cloud) — renvoie un score simulé mais déterministe. Le champ `mocked: true` de la réponse le signale explicitement |

Rien n'est écrit en base ni on-chain pour cette première passe : le résultat (`kycVerifiedAt`)
reste uniquement dans `WalletIdentity`, côté appareil (`storageService`, chiffré comme le
reste du cache). Étape 3 (carte d'identité) affiche les champs extraits dans des champs
éditables — l'utilisateur corrige les erreurs OCR avant de valider, comme pour les titres
fonciers côté admin.

## Sécurité des données locales

- **Clé privée** : `expo-secure-store`, avec `requireAuthentication: true` — biométrie/code de
  l'appareil exigés à chaque lecture (`keyService.ts`).
- **PIN applicatif** : indépendant du verrou biométrique, protège l'ouverture de l'app
  (`pinService.ts`) — seul un hash salé (SHA-256) est stocké.
- **Cache local (attestations + PDFs)** : chiffré AES-256 (`cryptoService.ts`) avec une clé
  maîtresse elle-même dans le SecureStore — c'est ce chiffrement applicatif qui protège les
  données dans AsyncStorage (non chiffré au repos par lui-même).
- **Auto-verrouillage** : l'app se reverrouille (PIN/biométrie requis) dès qu'elle repasse en
  arrière-plan (`App.tsx`).
- **"Seul le propriétaire peut stocker ses propres documents"** : déjà garanti côté backend —
  `GET /documents/my` et `GET /did/my` ne renvoient que les documents/clés de l'utilisateur
  authentifié par son propre JWT ; le wallet n'a besoin d'ajouter aucun contrôle
  supplémentaire pour ça.

## Lancement — test rapide avec Expo Go

Avec les équivalents Expo Go choisis ci-dessus, aucun build natif n'est nécessaire : il suffit
d'installer l'app **Expo Go** sur le téléphone (App Store / Play Store) et de scanner un QR
code.

### 1. Prérequis

- **Node.js 18+** et npm, sur la machine qui fait tourner le projet.
- L'app **Expo Go** installée sur le téléphone (gratuite, App Store ou Play Store).
- Téléphone et PC/Mac **sur le même réseau Wi-Fi**.
- L'app TrustWedge déjà démarrée : `docker compose up -d` à la racine du repo.

### 2. Installer les dépendances

```powershell
# Depuis la racine du repo
npm install
```

### 3. Configurer l'URL de l'API

Le téléphone ne résout pas `localhost` : dans [apps/wallet/app.json](../apps/wallet/app.json)
→ `expo.extra.trustwedgeApiUrl`, remplacer `localhost` par l'IP LAN de la machine qui fait
tourner `docker compose` (ex. `http://192.168.1.20:8000/api`). Trouver cette IP avec
`ipconfig` (adresse IPv4 de la carte Wi-Fi/Ethernet active).

### 4. Lancer

```powershell
cd apps/wallet
npm start
```

Un QR code s'affiche dans le terminal :

- **Android** : ouvrir l'app Expo Go, "Scan QR code".
- **iPhone** : ouvrir l'app **Appareil photo** native (pas Expo Go) et viser le QR — iOS
  propose d'ouvrir le lien dans Expo Go.

L'app TrustWedge Wallet se charge alors dans Expo Go. Modifier un fichier dans `apps/wallet/src`
recharge l'app automatiquement (rechargement à chaud).

### Si ça ne se connecte pas

- Vérifier que le pare-feu Windows n'bloque pas les connexions entrantes sur le port Metro
  (8081) — au premier lancement, Windows demande généralement l'autorisation.
- Si le Wi-Fi bloque les connexions entre appareils (réseaux publics/invités), relancer avec
  `npx expo start --tunnel` (plus lent, passe par un relai Expo, mais contourne ce blocage).

## Aller plus loin : build natif avec les libs demandées à l'origine

Le choix ci-dessus (Expo Go) est fait pour aller vite en test. Si vous voulez ensuite valider
le comportement avec les vraies libs prévues pour la prod (`react-native-keychain`,
`react-native-encrypted-storage`, `react-native-biometrics` — contrôle d'accès plus fin,
chiffrement au repos plus fort), il faut :

1. Réintroduire ces 3 dépendances dans `apps/wallet/package.json` (remplaçant
   `expo-secure-store`, `@react-native-async-storage/async-storage`,
   `expo-local-authentication`) et ajuster `keyService.ts` / `pinService.ts` /
   `sessionService.ts` / `storageService.ts` / `biometricService.ts` en conséquence (ce sont
   les 5 mêmes fichiers listés en section "Bibliothèques" ci-dessus).
2. Ajouter `expo-dev-client` en dépendance et dans `app.json` → `expo.plugins`.
3. Compiler un dev client une fois (sous Windows, Android uniquement en local — iOS nécessite
   un Mac ou EAS Build) :

```powershell
cd apps/wallet
npx expo install --fix
npx expo prebuild
npx expo run:android
```

4. Pour les sessions suivantes : `npx expo start --dev-client` au lieu de `npm start`.

Pour un émulateur Android (plutôt qu'un téléphone physique), `trustwedgeApiUrl` doit utiliser
`10.0.2.2` au lieu de `localhost`/de l'IP LAN (alias que l'émulateur utilise pour joindre l'hôte).

## Parcours de démonstration (Jean / Alice)

1. Un émetteur (université, notaire, admin — via le frontend web existant) délivre un
   titre foncier à l'adresse/DID de Jean.
2. Jean installe le wallet, choisit "Se connecter à mon compte TrustWedge", saisit son
   email/mot de passe (compte déjà créé pour lui) → le wallet importe son DID et sa clé
   privée, configure un PIN.
3. Jean ouvre son titre foncier dans "Mes attestations" → "Partager par QR code".
4. Alice ouvre son propre wallet (ou toute app capable de lire le QR), scanne le code →
   `VerifyResultScreen` affiche "✅ Document authentique — Propriétaire : Jean" (ou
   "❌ invalide" si le document a été révoqué ou transféré depuis).
