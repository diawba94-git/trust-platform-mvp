#!/usr/bin/env node
/**
 * Initialisation d'un environnement TrustWedge local.
 *
 *   node scripts/init-environment.js
 *
 * Fait, dans l'ordre :
 *   1. Génère un ".env" exploitable à partir de ".env.example" (ou complète un ".env" déjà
 *      présent) — tout secret marqué "__GENERATE__" ou manquant est remplacé par une valeur
 *      aléatoire cryptographiquement sûre (Node `crypto`). Idempotent : ne touche jamais une
 *      valeur déjà renseignée.
 *   2. Crée les répertoires de données attendus par docker-compose.yml (volumes bind-mount),
 *      s'ils n'existent pas déjà.
 *   3. Génère le réseau blockchain Besu QBFT (clés des 4 nœuds + genesis.json) via
 *      scripts/generate-network.bat, sauf si un réseau existe déjà — ne régénère jamais un
 *      réseau existant (cela invaliderait l'identité des nœuds déjà démarrés).
 *   4. Affiche les prochaines étapes (démarrage Docker Compose, déploiement du contrat).
 *
 * Documentation complète : docs/10-INITIALISATION-ENVIRONNEMENT.md
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(ROOT, ".env.example");
const PLACEHOLDER = "__GENERATE__";

// ============================================================
// Génération de secrets
// ============================================================

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString("hex");
}

function randomBase64(bytes) {
  return crypto.randomBytes(bytes).toString("base64");
}

// Clé Fernet (cryptography.fernet côté backend) : 32 octets aléatoires en base64 URL-safe.
function randomFernetKey() {
  return crypto.randomBytes(32).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
}

// Mot de passe/secret alphanumérique (pas de caractère spécial : évite tout souci
// d'échappement dans une DATABASE_URL, un docker-compose.yml ou un shell).
function randomAlnum(length) {
  return crypto
    .randomBytes(length * 2)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);
}

// Clé privée Ethereum (secp256k1) : 32 octets aléatoires, préfixés "0x" comme attendu par
// eth_account.Account.from_key() côté backend.
function randomPrivateKey() {
  return "0x" + randomHex(32);
}

// Chaque génération est différée (fonction, pas valeur) : elle ne s'exécute que si la
// variable correspondante est effectivement manquante ou marquée PLACEHOLDER.
const GENERATORS = {
  PRIVATE_KEY: randomPrivateKey,
  POSTGRES_PASSWORD: () => randomAlnum(24),
  JWT_SECRET: () => randomHex(48),
  BLOCKSCOUT_SECRET_KEY_BASE: () => randomBase64(64),
  KONG_PG_PASSWORD: () => randomHex(16),
  SECRET_KEY: () => randomHex(32),
  ADMIN_PASSWORD: () => randomAlnum(16),
  ENCRYPTION_KEY: randomFernetKey,
};

// Valeurs par défaut non sensibles, appliquées seulement si la clé est absente du fichier
// (jamais si elle est présente avec une valeur différente — on ne veut pas écraser une
// personnalisation existante, ex: un domaine de production déjà configuré).
const DEFAULTS = {
  DEPLOY_HOST: "localhost",
  BESU_NETWORK_ID: "1337",
  BESU_RPC_URL: "http://besu-node-1:8545",
  BESU_WS_URL: "ws://besu-node-1:8546",
  BESU_CHAIN_ID: "1337",
  BESU_GAS_PRICE: "0",
  POSTGRES_USER: "trustwedge",
  POSTGRES_DB: "trustwedge",
  IPFS_API_URL: "http://ipfs:5001",
  IPFS_GATEWAY_URL: "http://ipfs:8080",
  JWT_ALGORITHM: "HS256",
  JWT_EXPIRATION: "3600",
  NODE_ENV: "development",
  API_PORT: "8000",
  REACT_APP_API_URL: "/api",
  REACT_APP_WS_URL: "ws://localhost:8000/ws",
  REACT_APP_BLOCKCHAIN_RPC: "http://localhost:8645",
  ADMIN_EMAIL: "admin@trustwedge.com",
};

// ============================================================
// Manipulation du fichier .env (préserve commentaires et ordre des lignes)
// ============================================================

function readLines(filePath) {
  return fs.readFileSync(filePath, "utf8").split(/\r?\n/);
}

function getValue(lines, key) {
  const line = lines.find((l) => l.startsWith(key + "="));
  return line === undefined ? undefined : line.slice(key.length + 1);
}

function setValue(lines, key, value) {
  const idx = lines.findIndex((l) => l.startsWith(key + "="));
  if (idx === -1) {
    lines.push(`${key}=${value}`);
  } else {
    lines[idx] = `${key}=${value}`;
  }
}

function isUnset(value) {
  return value === undefined || value === "" || value === PLACEHOLDER;
}

function ensureEnvFile() {
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    console.error(`Fichier introuvable : ${ENV_EXAMPLE_PATH}`);
    process.exit(1);
  }

  const isNewFile = !fs.existsSync(ENV_PATH);
  const lines = readLines(isNewFile ? ENV_EXAMPLE_PATH : ENV_PATH);

  const generated = [];
  for (const [key, generate] of Object.entries(GENERATORS)) {
    if (isUnset(getValue(lines, key))) {
      setValue(lines, key, generate());
      generated.push(key);
    }
  }

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (getValue(lines, key) === undefined) {
      setValue(lines, key, value);
    }
  }

  // DATABASE_URL est dérivée des trois variables Postgres ci-dessus plutôt que générée de
  // façon indépendante, pour rester cohérente même si POSTGRES_PASSWORD vient d'être créé.
  if (isUnset(getValue(lines, "DATABASE_URL"))) {
    const user = getValue(lines, "POSTGRES_USER") || DEFAULTS.POSTGRES_USER;
    const password = getValue(lines, "POSTGRES_PASSWORD");
    const db = getValue(lines, "POSTGRES_DB") || DEFAULTS.POSTGRES_DB;
    setValue(lines, "DATABASE_URL", `postgresql://${user}:${password}@postgres:5432/${db}`);
    generated.push("DATABASE_URL");
  }

  // CONTRACT_ADDRESS n'est jamais généré : renseigné manuellement après déploiement du
  // contrat (voir §4 de la sortie du script). On s'assure seulement que la clé existe, pour
  // que docker-compose ne se plaigne pas d'une variable absente.
  if (getValue(lines, "CONTRACT_ADDRESS") === undefined) {
    setValue(lines, "CONTRACT_ADDRESS", "");
  }

  fs.writeFileSync(ENV_PATH, lines.join("\n"));

  if (isNewFile) {
    console.log(`[env] .env créé à partir de .env.example`);
  } else {
    console.log(`[env] .env existant complété (aucune valeur déjà présente n'a été modifiée)`);
  }
  if (generated.length > 0) {
    console.log(`[env] Valeurs générées : ${generated.join(", ")}`);
  } else {
    console.log(`[env] Rien à générer — toutes les valeurs étaient déjà renseignées`);
  }
  if (generated.includes("ADMIN_PASSWORD")) {
    console.log(
      `[env] ADMIN_PASSWORD généré — consulter sa valeur dans .env avant de fermer ce terminal`
    );
  }
}

// ============================================================
// Répertoires de données (volumes bind-mount de docker-compose.yml)
// ============================================================

function ensureDataDirectories() {
  const dirs = [
    "services/postgres-data",
    "services/ipfs-data",
    "services/blockscout-data",
    "services/kong-data",
    "services/nodes/node-1/data",
    "services/nodes/node-2/data",
    "services/nodes/node-3/data",
    "services/nodes/node-4/data",
  ];

  const created = dirs.filter((d) => !fs.existsSync(path.join(ROOT, d)));
  for (const dir of created) {
    fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
  }

  if (created.length > 0) {
    console.log(`[dirs] Répertoires créés : ${created.join(", ")}`);
  } else {
    console.log(`[dirs] Tous les répertoires de données existent déjà`);
  }
}

// ============================================================
// Réseau Besu QBFT (clés des 4 nœuds + genesis.json)
// ============================================================

function besuNetworkAlreadyGenerated() {
  return (
    fs.existsSync(path.join(ROOT, "genesis.json")) &&
    fs.existsSync(path.join(ROOT, "services/nodes/node-1/data/key"))
  );
}

function ensureBesuNetwork() {
  if (besuNetworkAlreadyGenerated()) {
    console.log(
      `[besu] Réseau déjà généré (genesis.json + clés présentes) — non régénéré ` +
        `(régénérer invaliderait l'identité des nœuds existants)`
    );
    return;
  }

  if (process.platform !== "win32") {
    console.log(
      `[besu] Réseau non généré : scripts/generate-network.bat est un script Windows (utilise ` +
        `docker run avec %cd%). Sur cette plateforme, générez-le manuellement en adaptant ce ` +
        `script, ou exécutez-le depuis un environnement Windows.`
    );
    return;
  }

  console.log(`[besu] Génération du réseau QBFT (4 nœuds) via generate-network.bat...`);
  try {
    execFileSync("cmd", ["/c", "scripts\\generate-network.bat"], {
      cwd: ROOT,
      stdio: "inherit",
    });
    console.log(`[besu] Réseau généré avec succès`);
  } catch (err) {
    console.error(
      `[besu] Échec de la génération du réseau — Docker Desktop est-il démarré ? (${err.message})`
    );
    process.exitCode = 1;
  }
}

// ============================================================
// Résumé / prochaines étapes
// ============================================================

function printNextSteps() {
  console.log(`
Initialisation terminée. Prochaines étapes (voir aussi README.md § Lancement) :

  1. docker compose up -d --build
  2. cd services\\nodes && npm install                          (une seule fois)
  3. npx hardhat run scripts/deploy.js --network besu           (déploie le contrat)
  4. Reporter l'adresse affichée dans CONTRACT_ADDRESS (.env)
  5. cd ..\\.. && docker compose up -d backend                   (redémarre avec la nouvelle adresse)
  6. Ouvrir http://localhost:8000

Détail : docs/10-INITIALISATION-ENVIRONNEMENT.md
`);
}

// ============================================================

function main() {
  ensureEnvFile();
  ensureDataDirectories();
  ensureBesuNetwork();
  printNextSteps();
}

main();
