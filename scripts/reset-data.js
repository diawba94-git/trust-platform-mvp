#!/usr/bin/env node
/**
 * Réinitialisation complète des données TrustWedge — base PostgreSQL ET blockchain.
 *
 *   node scripts/reset-data.js --yes
 *
 * La blockchain étant immuable, "nettoyer" son contenu ne peut se faire qu'en repartant
 * d'une chaîne vierge : ce script arrête les nœuds Besu, efface leurs données et le
 * `genesis.json`, régénère un réseau QBFT neuf, redéploie le contrat `DocumentRegistry`
 * (nouvelle CONTRACT_ADDRESS écrite dans .env par scripts/deploy.js), puis réindexe
 * Blockscout depuis zéro. Côté PostgreSQL, toutes les tables sont vidées, à l'exception du
 * compte applicatif ayant le rôle ADMIN (conservé pour rester connecté ensuite).
 *
 * IRRÉVERSIBLE : tout document, workflow, compte (hors admin) et historique on-chain est
 * perdu. Nécessite une confirmation explicite (--yes) — voir docs/11-RESET-DONNEES.md.
 *
 * Étapes :
 *   1. Arrête les nœuds Besu, Blockscout et le backend (Postgres/IPFS/Kong restent actifs).
 *   2. Vide les tables applicatives en base, conserve uniquement le(s) compte(s) role=ADMIN.
 *   3. Efface les données Besu (genesis.json, clés des 4 nœuds) et Blockscout.
 *   4. Régénère le réseau Besu QBFT (scripts/generate-network.bat) et redémarre les nœuds.
 *   5. Redéploie le contrat DocumentRegistry (Hardhat) — met à jour CONTRACT_ADDRESS dans .env.
 *   6. Redémarre backend, Blockscout et blockscout-db.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

function readEnv() {
  const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

function run(cmd, args, opts = {}) {
  console.log(`  $ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: false, ...opts });
}

// Sleep synchrone, sans dépendre de "sleep"/"timeout" (indisponibles ou différents selon l'OS).
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function step(title, fn) {
  console.log(`\n=== ${title} ===`);
  fn();
}

// ============================================================
// 0. Confirmation
// ============================================================

const confirmed = process.argv.includes("--yes");

console.log(`
Réinitialisation TrustWedge — PostgreSQL ET blockchain.

Cette opération est IRRÉVERSIBLE et va :
  - Vider toutes les tables applicatives (documents, workflows, comptes...), en ne
    conservant QUE le(s) compte(s) ayant le rôle ADMIN.
  - Effacer tout l'historique de la blockchain Besu (genesis + clés des 4 nœuds) et
    redéployer le contrat DocumentRegistry à une nouvelle adresse.
  - Effacer les données indexées par Blockscout (seront réindexées depuis la chaîne neuve).

Aucune autre donnée (Kong, IPFS) n'est touchée.
`);

if (!confirmed) {
  console.log("Relancer avec --yes pour confirmer et exécuter la réinitialisation.");
  process.exit(1);
}

const env = readEnv();
const PG_USER = env.POSTGRES_USER || "trustwedge";
const PG_DB = env.POSTGRES_DB || "trustwedge";

// ============================================================
// 1. Arrêt des services concernés (Postgres/IPFS/Kong/frontend restent actifs)
// ============================================================

step("1/6 — Arrêt de Besu, Blockscout et du backend", () => {
  run("docker", [
    "compose",
    "stop",
    "backend",
    "blockscout",
    "blockscout-frontend",
    "blockscout-db",
    "besu-node-1",
    "besu-node-2",
    "besu-node-3",
    "besu-node-4",
  ]);
});

// ============================================================
// 2. Nettoyage PostgreSQL — conserve uniquement le(s) compte(s) role=ADMIN
// ============================================================

step("2/6 — Nettoyage de la base applicative (conservation du/des compte(s) ADMIN)", () => {
  const sql = `
    BEGIN;
    TRUNCATE workflow_steps, workflows, invitations, document_shares, kyc_verifications, notifications, documents
      RESTART IDENTITY CASCADE;
    UPDATE users SET created_by = NULL WHERE role <> 'ADMIN';
    DELETE FROM users WHERE role <> 'ADMIN';
    SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
    COMMIT;
  `.trim();
  run("docker", ["exec", "trustwedge-postgres", "psql", "-U", PG_USER, "-d", PG_DB, "-c", sql]);
  run("docker", [
    "exec",
    "trustwedge-postgres",
    "psql",
    "-U",
    PG_USER,
    "-d",
    PG_DB,
    "-c",
    "SELECT id, email, role FROM users;",
  ]);
});

// ============================================================
// 3. Effacement des données Besu et Blockscout sur disque
// ============================================================

function rm(relPath) {
  const full = path.join(ROOT, relPath);
  if (fs.existsSync(full)) {
    fs.rmSync(full, { recursive: true, force: true });
    console.log(`  supprimé : ${relPath}`);
  }
}

step("3/6 — Effacement des données Besu et Blockscout", () => {
  rm("genesis.json");
  rm("services/nodes/networkFiles");
  for (const n of [1, 2, 3, 4]) {
    rm(`services/nodes/node-${n}/data`);
    fs.mkdirSync(path.join(ROOT, `services/nodes/node-${n}/data`), { recursive: true });
  }
  rm("services/blockscout-data");
  fs.mkdirSync(path.join(ROOT, "services/blockscout-data"), { recursive: true });
});

// ============================================================
// 4. Régénération du réseau Besu QBFT et redémarrage des nœuds
// ============================================================

step("4/6 — Régénération du réseau Besu QBFT", () => {
  run("cmd", ["/c", "scripts\\generate-network.bat"]);
  run("docker", [
    "compose",
    "up",
    "-d",
    "besu-node-1",
    "besu-node-2",
    "besu-node-3",
    "besu-node-4",
  ]);
  console.log("  attente que besu-node-1 soit sain...");
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const out = execFileSync(
        "docker",
        ["inspect", "-f", "{{.State.Health.Status}}", "trustwedge-besu-node-1"],
        { cwd: ROOT }
      )
        .toString()
        .trim();
      if (out === "healthy") {
        console.log("  besu-node-1 est sain");
        break;
      }
    } catch (_) {
      // ignore, réessaie
    }
    sleepSync(3000);
  }
});

// ============================================================
// 5. Redéploiement du contrat (met à jour CONTRACT_ADDRESS dans .env)
// ============================================================

step("5/6 — Redéploiement du contrat DocumentRegistry", () => {
  const nodesDir = path.join(ROOT, "services/nodes");
  // shell:true nécessaire sur Windows : npm/npx sont des scripts .cmd, non exécutables
  // directement par execFileSync (contrairement à docker.exe) sans passer par un shell.
  const npmOpts = { cwd: nodesDir, shell: process.platform === "win32" };
  if (!fs.existsSync(path.join(nodesDir, "node_modules"))) {
    run("npm", ["install"], npmOpts);
  }
  run("npx", ["hardhat", "run", "scripts/deploy.js", "--network", "besu"], npmOpts);
});

// ============================================================
// 6. Redémarrage backend + Blockscout
// ============================================================

step("6/6 — Redémarrage du backend et de Blockscout", () => {
  run("docker", ["compose", "up", "-d", "backend"]);
  run("docker", ["compose", "up", "-d", "blockscout-db", "blockscout", "blockscout-frontend"]);
});

console.log(`
Réinitialisation terminée.
  - Seul le compte ADMIN a été conservé en base (mêmes email/DID qu'avant).
  - Le contrat DocumentRegistry a été redéployé (nouvelle CONTRACT_ADDRESS dans .env).
  - Blockscout va réindexer la nouvelle chaîne depuis le bloc 0 (quelques instants).

Vérifier : docker compose ps
           curl http://localhost:8000/api/health
`);
