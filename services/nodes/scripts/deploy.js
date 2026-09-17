const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("=".repeat(60));
  console.log("🚀 TRUST PLATFORM - DÉPLOIEMENT DU CONTRAT");
  console.log("=".repeat(60));
  console.log();

  // Récupérer le déployeur
  const [deployer] = await hre.ethers.getSigners();
  console.log(`🔑 Déployeur : ${deployer.address}`);
  console.log(`💰 Solde : ${await hre.ethers.provider.getBalance(deployer.address)} ETH`);
  console.log();

  // Déployer le contrat
  console.log("📦 Déploiement de DocumentRegistry...");
  const DocumentRegistry = await hre.ethers.getContractFactory("DocumentRegistry");
  const documentRegistry = await DocumentRegistry.deploy();
  await documentRegistry.waitForDeployment();

  const address = await documentRegistry.getAddress();
  console.log(`✅ Contrat déployé à : ${address}`);
  console.log();

  // ============================================================
  // CONFIGURATION DES RÔLES
  // ============================================================
  console.log("🔐 Configuration des rôles...");

  const ISSUER_ROLE = await documentRegistry.ISSUER_ROLE();
  const VERIFIER_ROLE = await documentRegistry.VERIFIER_ROLE();
  const NOTARY_ROLE = await documentRegistry.NOTARY_ROLE();
  const ADMIN_ROLE = await documentRegistry.ADMIN_ROLE();

  // Le déployeur a déjà ADMIN_ROLE et ISSUER_ROLE via le constructeur
  console.log(`  ✅ ADMIN_ROLE déjà attribué à ${deployer.address}`);
  console.log(`  ✅ ISSUER_ROLE déjà attribué à ${deployer.address}`);

  // Attribuer VERIFIER_ROLE au déployeur (pour les tests)
  await (await documentRegistry.grantRole(VERIFIER_ROLE, deployer.address)).wait();
  console.log(`  ✅ VERIFIER_ROLE attribué à ${deployer.address}`);

  // Attribuer NOTARY_ROLE au déployeur (pour les tests)
  await (await documentRegistry.grantRole(NOTARY_ROLE, deployer.address)).wait();
  console.log(`  ✅ NOTARY_ROLE attribué à ${deployer.address}`);

  console.log();

  // ============================================================
  // SAUVEGARDE DANS .env
  // ============================================================
  console.log("💾 Sauvegarde de l'adresse du contrat...");

  const envPath = path.join(__dirname, "..", "..", "..", ".env");
  let envContent = "";

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  if (envContent.includes("CONTRACT_ADDRESS=")) {
    envContent = envContent.replace(/CONTRACT_ADDRESS=.*/, `CONTRACT_ADDRESS=${address}`);
  } else {
    envContent += `\nCONTRACT_ADDRESS=${address}\n`;
  }

  fs.writeFileSync(envPath, envContent);
  console.log(`  ✅ CONTRACT_ADDRESS=${address} sauvegardé dans .env`);
  console.log();

  // ============================================================
  // VÉRIFICATION
  // ============================================================
  console.log("🔍 Vérification du contrat...");

  const name = await documentRegistry.name();
  const symbol = await documentRegistry.symbol();

  console.log(`  📛 Nom : ${name}`);
  console.log(`  🏷️  Symbole : ${symbol}`);
  console.log();

  // Vérifier les rôles
  const hasIssuer = await documentRegistry.hasRole(ISSUER_ROLE, deployer.address);
  const hasVerifier = await documentRegistry.hasRole(VERIFIER_ROLE, deployer.address);
  const hasNotary = await documentRegistry.hasRole(NOTARY_ROLE, deployer.address);

  console.log("📋 Rôles du déployeur :");
  console.log(`  ${hasIssuer ? '✅' : '❌'} ISSUER_ROLE`);
  console.log(`  ${hasVerifier ? '✅' : '❌'} VERIFIER_ROLE`);
  console.log(`  ${hasNotary ? '✅' : '❌'} NOTARY_ROLE`);
  console.log();

  // ============================================================
  // RÉSUMÉ FINAL
  // ============================================================
  console.log("=".repeat(60));
  console.log("✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !");
  console.log("=".repeat(60));
  console.log();
  console.log("📋 Résumé :");
  console.log(`   📜 Contrat : DocumentRegistry`);
  console.log(`   📍 Adresse : ${address}`);
  console.log(`   🔗 Réseau  : ${hre.network.name}`);
  console.log(`   ⛓️  Chain ID : ${(await hre.ethers.provider.getNetwork()).chainId}`);
  console.log(`   👤 Déployeur : ${deployer.address}`);
  console.log();
  console.log("📌 Prochaines étapes :");
  console.log("   1. Copiez l'adresse du contrat dans votre .env");
  console.log("   2. Lancez le backend : docker-compose up -d");
  console.log("   3. Testez l'API : curl http://localhost:8000/health");
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erreur lors du déploiement :", error);
    process.exit(1);
  });