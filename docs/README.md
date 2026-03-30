# Contributions / Historique des tâches

Ce document liste les principales contributions de chaque membre du projet.

---

## 🧑‍💻 Théotime

- **23/02/2026**
  - refactor : suppression des données `WAVES` et intégration de la logique de vagues directement dans `WaveSystem`.
  - feat : ajout des écrans de personnage, d'arme et de jeu avec contenu dynamique.
  - feat : ajustement de la durée du cycle jour/nuit et implémentation de l'éclairage de la torche du joueur.
  - feat : amélioration du visuel du cycle jour/nuit et des indicateurs UI.
  - feat : implémentation de l'écran de sélection d'arme et mise à jour des définitions de personnages et d'armes.
  - Merge de branche `main` (synchronisation).
- **16/03/2026**
  - A aidé Lucas sur le game concept
  - A fait des recherches sur l'implémentation du multi dans le jeu
  - Refactorisation du jeu
- **30/03/2026**
  - Implémentation complète du multijoueur avec serveur relay Socket.IO
  - Synchronisation du cycle jour/nuit, des vagues et du niveau entre tous les joueurs
  - Système de niveau global partagé avec choix d'amélioration individuel et système "Prêt"
  - Boutique entre les vagues accessible à tous les joueurs avec or individuel
  - Statistiques d'éliminations par joueur et par équipe
  - Amélioration de la fluidité côté client (prédiction de mouvement, interpolation des entités)
  - Correction de plusieurs bugs multijoueur (désynchronisation, affichage, joueurs morts)
  - Refactorisation de l'architecture serveur

## 🛡️ Théo

- **23/02/2026**
  - fix : restauration de la barre d'armure et du texte flottant des dégâts après le refactor UI.
  - feature : ajout d'une armure en bouclier de vie + indicateurs visuels.
  - feature : boutique entre chaque vague avec inflation des prix (issues #12).
  - feature : vagues infinies avec scaling progressif (issue #2).
  - fix : geler toutes les entités pendant la pause, le level-up et le game over (issue #1).
  - Merge de pull request `#18` (feature/infinite-waves).
  - Merge de branche `main` (synchronisation).
- **16/03/2026**
  - Recherche des musiques du jeu
  - Bugfixes
- **30/03/2026**
  - feat : intégration complète de l'audio (musiques de menu, in-game par personnage, game over)
  - feat : effets sonores (click UI, mort ennemi, ramassage XP, level up, achat boutique, début de vague, hit joueur, mort joueur)
  - feat : volume mixer dans le menu pause (musique + SFX avec sliders)
  - feat : gestion de l'autoplay navigateur (déblocage au premier input utilisateur)
  - feat : effet fondu au noir lors de la mort du joueur avant l'écran de défaite
  - fix : timing du SFX de mort joueur (délai avant la musique game over)
  - fix : intégration audio compatible multijoueur (séquence game over centralisée host/client)
  - merge : résolution des conflits avec main (Game.ts, UIManager.ts, ui.css)

## 🛠️ Louis

- **23/02/2026**
  - fix : le flash de dégâts fonctionne désormais sur les modèles GLB avec composants de rendu imbriqués (issue #9).
  - fix : correction de dysfonctionnement clavier sur les layouts français (issue #6).
  - feat : ajout du mesh de Trump (issue #5).
- **16/03/2026**
  - Gestion des assets
  - Implémentation des animations avec mixamo 
  - Création de la vidéo

## 🌐 Lucas

- **23/02/2026**
  - Définition du projet et de son contenu
  - Renommage en "Dusk of Democracy".
  - Ajout de `.gitignore` et retrait de `node_modules`/`dist` du suivi Git.
  - Création de la map.

- **16/03/2026**
  - Continue la création de la map
  - Création du game concept sur Canva
  - Date de sortie et prix
 
-  **30/03/2026**
  - Terminer la création de la map
  - Ajout des collisions sur les bâtiments
  - Ajout des lumières 

> Pour toute nouvelle contribution, ajouter une ligne ci-dessous avec la date, l'auteur et le détail de la modification.


---

## 📌 Prochaines tâches

Pour la prochaine session de travail, les éléments suivants sont prévus :

- Développement de la map
- Développement des animations
- Intégration des musiques dans le jeu
- Développement du multijoueur

---

## 📋 Gestion de projet

La gestion des tâches et du suivi du projet est réalisée à l’aide des **Issues GitHub**.  
Chaque fonctionnalité, amélioration ou correction de bug est associée à une issue afin de faciliter le suivi du développement et la répartition du travail entre les membres de l’équipe.
