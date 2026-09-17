@echo off
:: Point d'entree unique pour initialiser un environnement TrustWedge local :
:: genere .env, cree les repertoires de donnees, genere le reseau Besu QBFT.
:: Voir docs/10-INITIALISATION-ENVIRONNEMENT.md pour le detail.
node "%~dp0init-environment.js"
