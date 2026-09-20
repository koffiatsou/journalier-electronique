# Journalier V64 — test Microsoft Graph / OneDrive

Ce dossier est autonome pour tester la connexion Entra + Microsoft Graph depuis Journalier V64.

## 1. Prérequis

- Node.js installé (avec npm)
- Chrome ou Edge
- L'application Entra existante de Journalier

## 2. Installation

Ouvrir PowerShell dans ce dossier puis :

```powershell
npm install
npm run dev
```

Vite doit démarrer sur :

http://localhost:8000

## 3. Test

1. Ouvrir http://localhost:8000 dans Chrome/Edge.
2. Dans Journalier, ouvrir la connexion Microsoft.
3. Cliquer sur « Se connecter avec Microsoft ».
4. Si Microsoft demande un consentement pour `Files.ReadWrite`, l'accepter.
5. Une fois connecté, cliquer sur « Tester OneDrive / Graph ».

Le test crée uniquement :

Journalier/test-graph.json

dans le OneDrive du compte connecté.

Aucune donnée d'élève ou séance n'est envoyée pendant ce test.

## 4. Entra

La V64 utilise l'application Entra déjà utilisée par la V14 :
- client ID : celui déjà présent dans Journalier
- tenant : celui déjà présent dans Journalier
- redirect URI : http://localhost:8000/msal-redirect.html

Ne modifiez rien dans Entra avant le premier test. Si Microsoft affiche une erreur de redirect URI ou de consentement, notez le message exact.

## 5. Arrêt

Dans PowerShell : Ctrl+C
