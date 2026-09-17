require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: "../../.env" });

const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  paths: {
    sources: "./contrat",
    scripts: "./scripts",
  },
  networks: {
    besu: {
      // Port exposé par besu-node-1 sur l'hôte (voir docker-compose.yml)
      url: process.env.BESU_RPC_URL_HOST || "http://localhost:8645",
      accounts: [PRIVATE_KEY],
      chainId: Number(process.env.BESU_CHAIN_ID || 1337),
    },
  },
};
