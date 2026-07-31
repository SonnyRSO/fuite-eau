# Relevés d'eau

Appli web mobile pour gérer vos résidences, leurs adresses/compteurs, et suivre
les relevés (photo + fuite suspectée + suivi plombier), partagée en temps réel
entre plusieurs personnes.

## 1. Créer le projet Firebase (gratuit)

1. Va sur https://console.firebase.google.com et crée un nouveau projet.
2. Dans le projet, va dans **Databases & Storage > Firestore** → **Créer une base
   de données** → choisis une région proche (ex. `europe-west1`).
3. Va dans **Paramètres du projet** (roue crantée) → onglet **Général** →
   descends jusqu'à "Vos applications" → clique sur l'icône **Web** (`</>`)
   pour ajouter une appli web. Donne-lui un nom (ex. "releves-eau").
4. Firebase t'affiche un objet `firebaseConfig` avec des clés
   (`apiKey`, `authDomain`, etc.). Garde cette page ouverte, tu en as besoin
   à l'étape 3.

Aucune photo ni numéro de compteur n'est stocké : pas besoin de Firebase
Storage, seulement Firestore.

## 2. Publier les règles de sécurité

Dans la console Firebase, va dans **Firestore Database > Règles**, colle le
contenu de `firestore.rules`, puis clique sur **Publier**.

## 3. Configurer le projet en local

```bash
npm install
cp .env.example .env
```

Ouvre `.env` et remplis les 6 valeurs avec celles de ton `firebaseConfig`
(étape 1.5) :

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Lance en local pour tester :

```bash
npm run dev
```

## 4. Mettre sur GitHub

```bash
git init
git add .
git commit -m "Première version"
git branch -M main
git remote add origin https://github.com/<ton-utilisateur>/releves-eau.git
git push -u origin main
```

⚠️ Le fichier `.env` n'est **jamais** envoyé sur GitHub (il est dans
`.gitignore`) — tes clés Firebase ne seront donc pas visibles publiquement
dans le code. Elles doivent en revanche être ajoutées comme "secrets" GitHub
pour que le déploiement automatique fonctionne (étape suivante).

## 5. Activer GitHub Pages + déploiement automatique

1. Sur GitHub, va dans **Settings > Pages** de ton dépôt → dans "Build and
   deployment", choisis **Source : GitHub Actions**.
2. Va dans **Settings > Secrets and variables > Actions** → **New repository
   secret**, et ajoute un secret pour chacune des 5 variables ci-dessus
   (mêmes noms, mêmes valeurs que dans ton `.env`).
3. Vérifie dans `vite.config.js` que la ligne `base: '/releves-eau/'`
   correspond bien au nom exact de ton dépôt GitHub. Si ton dépôt s'appelle
   différemment, remplace la valeur.
4. À chaque `git push` sur `main`, le workflow `.github/workflows/deploy.yml`
   build et publie automatiquement l'appli sur
   `https://<ton-utilisateur>.github.io/releves-eau/`.

## 6. Utilisation avec les 3 personnes

Il suffit de partager le lien GitHub Pages. Chaque personne :
- entre son prénom une fois (stocké seulement sur son téléphone, sert juste
  à identifier qui a fait quel relevé) ;
- voit les mêmes résidences/adresses/relevés en temps réel, grâce à Firestore.

## Fonctionnement de l'appli

- **Résidences** → peuvent contenir plusieurs **adresses** (avec des notes
  d'accès si besoin).
- Chaque personne choisit son prénom (Lucie / Noa / Sonny) à l'ouverture.
- Sur une adresse : bouton **Marquer un passage ici** → enregistre juste la
  date, le prénom, et si une fuite est suspectée + un commentaire.
- **Aucune photo ni numéro de compteur n'est envoyé sur le serveur** : par
  sécurité, les photos restent uniquement sur le téléphone de chacun. En cas
  de piratage du projet Firebase, aucune donnée sensible ne serait exposée.
- Si une fuite est suspectée, un badge rouge apparaît sur la résidence et
  l'adresse concernées, jusqu'à ce que quelqu'un marque **"Plombier passé"**.
- L'onglet **Tableau de bord** montre l'avancement global, qui a fait quoi,
  et les adresses restantes à visiter.

## Pistes d'amélioration possibles

- Authentification réelle (Firebase Auth) si vous voulez restreindre l'accès.
- Export CSV des adresses et passages.
- Notifications quand une fuite est signalée.

N'hésite pas à revenir vers moi si tu veux que j'ajoute une de ces
fonctionnalités, ou si tu bloques sur une étape de la configuration Firebase.
