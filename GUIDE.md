# Rogue Survivors -- Guide du jeu

---

## Concept

Rogue Survivors est un **bullet hell / rogue-like** en 3D vue du dessus. Tu incarnes un personnage politique satirique et tu dois survivre le plus longtemps possible face a des vagues d'ennemis de plus en plus nombreux et puissants.

Inspire par **Vampire Survivors** et **Megabonk**.

---

## Comment jouer

1. **Menu principal** -- Clique sur PLAY
2. **Selection du personnage** -- Choisis ton fighter
3. **Survie** -- Deplace-toi, esquive les ennemis, ramasse l'XP
4. **Level up** -- A chaque niveau, choisis une amelioration parmi 3
5. **Objectif** -- Survivre le plus longtemps possible

Les armes tirent **automatiquement**. Ton seul job : te deplacer, esquiver, et choisir les bons upgrades.

---

## Personnages

Chaque personnage a des stats et une arme de depart differentes.

### Donald Trump

| Stat | Valeur |
|------|--------|
| HP | 150 |
| Vitesse | 7 |
| Arme de depart | Executive Order |

**Profil :** Tank lent. Beaucoup de points de vie, parfait pour encaisser.
L'Executive Order tire un projectile unique puissant (15 degats, 0.5s cooldown).

---

### Charlie Kirk

| Stat | Valeur |
|------|--------|
| HP | 80 |
| Vitesse | 10 |
| Arme de depart | Tweet Storm |

**Profil :** Glass cannon rapide. Peu de HP mais tres agile.
Le Tweet Storm tire 3 projectiles en eventail (8 degats chacun, 0.3s cooldown) -- excellent pour le crowd control.

---

### Nicolas Maduro

| Stat | Valeur |
|------|--------|
| HP | 120 |
| Vitesse | 8 |
| Arme de depart | Bolivarian Blast |

**Profil :** Equilibre avec une arme AoE. Le Bolivarian Blast fait des degats de zone autour du joueur (25 degats dans un rayon de 4 unites, 1.0s cooldown).

---

## Armes

Les armes tirent automatiquement quand le cooldown est pret. Tu vises avec la souris (ou le stick droit).

| Arme | Degats | Cooldown | Pattern | Description |
|------|--------|----------|---------|-------------|
| **Executive Order** | 15 | 0.5s | Single | Un tir droit precis |
| **Tweet Storm** | 8 | 0.3s | Spread (3 proj, 25 deg) | Eventail de tweets |
| **Bolivarian Blast** | 25 | 1.0s | Area (rayon 4) | Explosion autour du joueur |
| **Wall Builder** | 12 | 0.8s | Spread (5 proj, 40 deg) | Large eventail de briques |
| **Sanctions** | 5 | 0.15s | Single | Mitraillette rapide |

### Patterns d'attaque

- **Single** -- Un projectile droit dans la direction visee. Simple et efficace.
- **Spread** -- Plusieurs projectiles en eventail. Bon pour les groupes.
- **Area** -- Degats de zone instantanes autour du joueur. Pas de projectile, juste une explosion.

---

## Ennemis

Les ennemis spawnent en dehors de l'ecran et marchent droit vers toi. Ils infligent des degats au contact.

| Ennemi | HP | Vitesse | Degats | XP | Description |
|--------|-----|---------|--------|----|-------------|
| **Protestor** | 20 | 3 | 10 | 10 | Ennemi de base. Lent, equilibre. |
| **Journalist** | 10 | 6 | 5 | 15 | Rapide mais fragile. Difficile a esquiver. |
| **Activist** | 80 | 1.5 | 25 | 30 | Tank lent. Encaisse beaucoup, frappe fort. |
| **Twitter Bot** | 5 | 5 | 3 | 5 | Ultra faible mais arrive en masse. |

### Cooldown de contact

Quand un ennemi te touche, il a un cooldown de **0.5 seconde** avant de pouvoir te retoucher. Ca t'empeche de mourir instantanement au contact.

---

## Systeme de vagues

Les ennemis arrivent par vagues. Chaque vague est plus dure que la precedente.

| Vague | Duree | Intervalle de spawn | Composition |
|-------|-------|---------------------|-------------|
| **1** | 30s | 1.5s | 10 Protestors |
| **2** | 40s | 1.2s | 15 Protestors + 5 Journalists |
| **3** | 50s | 1.0s | 20 Protestors + 10 Journalists + 10 Twitter Bots |
| **4** | 60s | 0.8s | 25 Protestors + 15 Journalists + 3 Activists |
| **5** | 75s | 0.6s | 30 Protestors + 20 Journalists + 5 Activists + 20 Twitter Bots |
| **6** | 90s | 0.4s | 40 Protestors + 30 Journalists + 8 Activists + 30 Twitter Bots |

Apres la vague 6, les vagues recommencent en boucle (avec la meme difficulte).

---

## Systeme d'XP et de niveaux

- Les ennemis tues laissent tomber des **gems d'XP** (losanges verts)
- Les gems sont attires vers toi quand tu passes a proximite (rayon magnetique de **3 unites** par defaut)
- Pour passer au niveau N, il faut **N x 100 XP**
  - Niveau 2 : 200 XP
  - Niveau 3 : 300 XP
  - Niveau 10 : 1000 XP
  - etc.

A chaque level up, le jeu se met en pause et tu choisis **1 amelioration parmi 3** proposees au hasard.

---

## Ameliorations (Upgrades)

A chaque level up, 3 ameliorations aleatoires sont proposees. Chaque upgrade peut etre prise plusieurs fois (jusqu'a son niveau max).

| Upgrade | Effet par niveau | Niv. max | Cumul max |
|---------|-----------------|----------|-----------|
| **Thick Skin** | +25 HP max | 5 | +125 HP |
| **Fast Feet** | +15% vitesse | 5 | ~2x vitesse |
| **Big Hands** | +20% degats | 5 | ~2.5x degats |
| **Rapid Fire** | -10% cooldown armes | 5 | ~0.59x cooldown |
| **XP Magnet** | +50% rayon de pickup | 3 | ~3.4x rayon |
| **Body Armor** | +5 armure (reduction plate) | 5 | +25 armure |
| **Double Tap** | +1 projectile par attaque | 3 | +3 projectiles |
| **First Aid** | Soigne 30 HP (instantane) | 99 | Illimite |

### Comment l'armure fonctionne

L'armure reduit les degats recus de facon plate :

```
Degats finaux = max(1, degats bruts - armure)
```

Exemple : un Activist frappe a 25 degats. Avec 10 d'armure, tu ne prends que 15 degats. Le minimum est toujours 1.

### Strategie de build

- **Build tank** : Thick Skin + Body Armor + First Aid -- encaisse tout
- **Build speed** : Fast Feet + XP Magnet -- esquive et level vite
- **Build DPS** : Big Hands + Rapid Fire + Double Tap -- tout explose

---

## Cycle jour/nuit

Le jeu alterne entre jour et nuit sur un cycle de **5 minutes** (300 secondes).

| Moment | Effet |
|--------|-------|
| **Jour** | Spawn et vitesse normaux |
| **Nuit** | Spawn x1.5, vitesse ennemie x1.2 |

La nuit, l'eclairage change visuellement : lumiere ambiante plus sombre, soleil plus bleu.

**Astuce :** Prepare-toi avant la nuit. Level up et choisis des upgrades defensifs si tu galeres.

---

## Boutique

Les ennemis droppent de l'**or** (1-5 pieces par kill). L'or sert a acheter des objets dans la boutique.

| Objet | Cout | Effet |
|-------|------|-------|
| **Heal Potion** | 50 or | +50 HP |
| **Speed Boots** | 100 or | +10% vitesse |
| **Armor Plate** | 150 or | +10 armure |

---

## HUD (Interface en jeu)

L'ecran de jeu affiche :

- **En haut a gauche** :
  - Barre de vie (rouge)
  - Barre d'XP (bleue)
- **En haut au centre** :
  - Numero de vague
  - Niveau actuel
- **En haut a droite** :
  - Timer (temps survecu)
  - Nombre de kills
  - Or accumule

---

## Controles detailles

### Clavier + Souris

| Touche | Action |
|--------|--------|
| W / Fleche haut | Avancer |
| S / Fleche bas | Reculer |
| A / Fleche gauche | Aller a gauche |
| D / Fleche droite | Aller a droite |
| Souris | Viser (le perso regarde la souris) |
| Clic gauche | Tirer (en plus de l'auto-fire) |
| E | Interagir |
| Echap | Pause |

### Gamepad (manette)

| Input | Action |
|-------|--------|
| Stick gauche | Se deplacer |
| Stick droit | Viser |
| RT (gachette droite) | Tirer |
| A | Interagir |
| Start | Pause |

La dead zone des sticks est de **0.15** (les micro-mouvements sont ignores).

---

## Mecaniques avancees

### Invulnerabilite apres degats

Quand le joueur prend un coup, il est **invulnerable pendant 0.3 seconde**. Ca empeche les degats en rafale quand tu es entoure.

### Attraction magnetique des XP gems

Les gems d'XP flottent sur place jusqu'a ce que tu passes dans le **rayon magnetique** (3 unites de base, augmentable avec XP Magnet). Une fois attires, ils foncent vers toi a une vitesse de 15 unites/s.

### Spawn des ennemis

Les ennemis spawnent a **25 unites** du joueur (en dehors du champ de la camera), a un angle aleatoire. Ils sont clampes aux limites de l'arene (80x80 unites).

### Arene

L'arene fait **80x80 unites** avec des murs aux bordures. Le joueur ne peut pas sortir. Les ennemis non plus.

---

## Ecran de Game Over

Quand ton personnage meurt (HP = 0), l'ecran de Game Over affiche :

- Temps survecu
- Niveau atteint
- Ennemis tues
- Vague atteinte
- Or gagne

Tu peux recommencer avec le meme personnage ou retourner au menu principal.
