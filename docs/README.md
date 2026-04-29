# Contributions / Historique des tâches

Ce document liste les principales contributions de chaque membre du projet.

---

## 🧑‍💻 Théotime

- **23/02/2026**
  - suppression des données `WAVES` et intégration de la logique de vagues directement dans `WaveSystem`.
  - ajout des écrans de personnage, d'arme et de jeu avec contenu dynamique.
  - ajustement de la durée du cycle jour/nuit et implémentation de l'éclairage de la torche du joueur.
  - amélioration du visuel du cycle jour/nuit et des indicateurs UI.
  - implémentation de l'écran de sélection d'arme et mise à jour des définitions de personnages et d'armes.
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
- **27/04/2026**
  - correction des erreurs TypeScript et nettoyage de plusieurs points globaux du code.
  - mise en ligne du frontend sur Vercel et du serveur multijoueur sur Render.
  - amélioration de la fluidité du multijoueur pour se rapprocher du comportement solo.
  - refonte de la gestion réseau avec une architecture orientée événements.
    - suppression de l'ancienne interface `WorldSnapshot` et de son traitement monolithique dans `NetworkManager`.
    - introduction de callbacks réseau dédiés pour le spawn des ennemis, les projectiles, les pickups, les effets de zone et la synchronisation d'état.
    - adaptation de `CombatSystem` pour relayer les projectiles, les effets de mur et les effets de zone via le host.
    - ajout d'un événement de spawn d'ennemi dans `WaveSystem`.
    - ajout d'un événement de création d'XP dans `XPSystem` lors de la mort d'un ennemi.
    - rendu de `isDead` public dans `Health` pour simplifier l'accès à l'état de mort.
    - ajout de vérifications côté client dans le script `Wall` pour que les dégâts ne soient appliqués que par le host.
  - amélioration des collisions de déplacement joueur avec raycasting.
  - séparation de la gestion réseau en deux flux distincts pour les joueurs et le monde.


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
- **27/04/2026**
  - feat : intégration de la map ville depuis l'éditeur PlayCanvas avec collisions physiques
  - feat : ajout des lampadaires PlayCanvas pour l'éclairage du mode nuit
  - feat : ciel image + overlay nuit (remplace le bleu uni)
  - chore : mise à jour visuelle de l'arène
  - feat : système de highscore persistant via localStorage (issue #17)
  - feat : toggle caméra top-down ↔ vue 3e personne
  - feat : auto-aim avec compromis équilibrés (combat assist)
  - fix : empêche l'animation de mort des ennemis de jouer deux fois
  - feat : ajout du modèle punk masculin pour le Journaliste
  - fix : ennemis qui passaient à travers les barrières routières
  - feat : ajout du modèle féminin pour le Gauchiste (renommé depuis « Militant »)
  - feat : ajout du Hazmat (ennemi tireur à distance) + modèle de projectile balle
  - feat : refonte de `wall_builder` en véritable mur de terre
  - feat : modèle d'explosion animée pour `bolivarian_blast`
  - feat : modèle oiseau Twitter pour les projectiles `tweet_storm`
  - feat : modèle livre pour les projectiles `executive_order`
  - feat : `Sanctions` renommé en `Injures` (projectiles texte avec insultes aléatoires)
  - feat : pause partagée en multi via touche ÉCHAP (état synchronisé entre joueurs)
  - perf : throttling du trafic réseau pour réduire la latence côté client
  - fix : envoi des inputs sur changement (au lieu de throttle) pour éviter le TP côté client
  - fix : explosion animée affichée aussi côté client
  - fix : scale d'explosion incohérent client/host corrigé
  - fix : collisions host pour les joueurs distants + bumping joueur vs joueur

## 🛠️ Louis

- **23/02/2026**
  - fix : le flash de dégâts fonctionne désormais sur les modèles GLB avec composants de rendu imbriqués (issue #9).
  - fix : correction de dysfonctionnement clavier sur les layouts français (issue #6).
  - feat : ajout du mesh de Trump (issue #5).
- **16/03/2026**
  - Gestion des assets
  - Implémentation des animations avec mixamo
  - Création de la vidéo
- **30/03/2026**
  - Intégration des animations GLB (idle, running, dying) pour le personnage Trump via PlayCanvas `anim` component avec state graph
  - Résolution du root motion (déplacement parasite du bone Hips) sur les fichiers GLB par script Python de modification binaire
  - Diagnostic et correction de la sélection d'animation dans les GLB multi-animations Blender/Mixamo (heuristique durée idle/run/die)
  - Ajout et intégration du personnage Charlie Kirk : modèle 3D, animations propres, scale adapté (modèle en mètres)
  - Création du dossier `public/assets/shared/` comme socle commun d'animations Mixamo réutilisables entre personnages
  - Ajout et intégration du personnage Nicolas Maduro : modèle 3D statique (mesh sans squelette), scale adapté
  - Ajout du champ `modelScale` dans `CharacterDef` pour gérer les différentes unités des modèles GLB (cm vs m)
  - fix : reset du cycle jour/nuit (`timeOfDay`, `nightFactor`, script `DayNightCycle`) au redémarrage d'une partie pour ne plus rester en mode nuit
  - feat : ajout du champ `modelYOffset` dans `CharacterDef` pour corriger le positionnement vertical des modèles GLB selon leur origine mesh ; application dans `PlayerFactory` et `RemotePlayerFactory`
  - fix : `RemotePlayerFactory` utilisait un scale hardcodé `0.01` au lieu de `charDef.modelScale` — corrigé pour cohérence avec les persos locaux
  - feat : persistance des réglages audio (volume musique / SFX) via `localStorage` (`dod_musicVolume`, `dod_sfxVolume`)

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
- **27/04/2026**
  - refonte de la carte pour améliorer la lisibilité, la circulation et l'identité visuelle globale du niveau.
  - ajout et intégration des assets pour les différents ennemis afin d'enrichir le vestiaire et varier les silhouettes en jeu.
  - ajout et intégration de nouvelles animations pour rendre les ennemis et les personnages plus vivants et plus cohérents visuellement.
  - ajout et intégration des armes et de leurs contenus visuels associés pour améliorer la clarté du gameplay.
  - refactorisation globale du projet pour clarifier la structure, mieux organiser les ressources et faciliter les futures évolutions.
  - travail de cohérence générale entre la map, les ennemis, les animations et les armes pour obtenir un rendu plus propre et plus homogène.

> Pour toute nouvelle contribution, ajouter une ligne ci-dessous avec la date, l'auteur et le détail de la modification.


---

## 📌 Prochaines tâches

Pour la prochaine session de travail, les éléments suivants sont prévus :

- Intégration de la map
- Développement des animations
- Fix bugs

---

## 📋 Gestion de projet

La gestion des tâches et du suivi du projet est réalisée à l’aide des **Issues GitHub**.  
Chaque fonctionnalité, amélioration ou correction de bug est associée à une issue afin de faciliter le suivi du développement et la répartition du travail entre les membres de l’équipe.
