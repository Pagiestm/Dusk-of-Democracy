# Rogue Survivors

Un rogue-like / bullet hell 3D inspir par Vampire Survivors et Megabonk, construit avec **PlayCanvas Engine** en full code (pas d'diteur).

Projet scolaire MDS.

---

## Tech Stack

| Outil | Version | Role |
|-------|---------|------|
| [PlayCanvas](https://playcanvas.com/) | ^2.16 | Moteur 3D (WebGL) |
| [Vite](https://vitejs.dev/) | ^6.0 | Bundler + serveur de dev |
| [TypeScript](https://www.typescriptlang.org/) | ^5.6 | Langage |

---

## Prerequisites

- **Node.js** >= 18 (LTS recommande)
- **npm** >= 9

Verifier l'installation :

```bash
node --version
npm --version
```

---

## Installation

```bash
# Cloner le repo (ou copier le dossier)
cd "/chemin/vers/Jeu Video"

# Installer les dependances
npm install
```

---

## Lancer le jeu

### Mode developpement (avec hot reload)

```bash
npm run dev
```

Le navigateur s'ouvre automatiquement sur `http://localhost:3000`.

### Build de production

```bash
npm run build
```

Les fichiers optimises sont generes dans le dossier `dist/`.

### Preview du build

```bash
npm run preview
```

---

## Structure du projet

```
.
|-- index.html                  # Page HTML principale
|-- package.json                # Dependances et scripts
|-- tsconfig.json               # Config TypeScript
|-- vite.config.ts              # Config Vite
|-- public/
|   |-- assets/
|       |-- models/             # Modeles 3D (.glb)
|       |-- textures/           # Textures (ground, skybox...)
|       |-- audio/              # Sons et musique
|-- src/
    |-- main.ts                 # Point d'entree de l'application
    |-- constants.ts            # Toutes les valeurs de configuration
    |-- types.ts                # Interfaces TypeScript partagees
    |-- core/
    |   |-- Game.ts             # Orchestrateur principal + state machine
    |   |-- InputManager.ts     # Gestion unifiee clavier/souris/gamepad
    |   |-- SceneSetup.ts       # Creation de l'arene, camera, lumieres
    |-- entities/
    |   |-- PlayerFactory.ts    # Creation du joueur
    |   |-- EnemyFactory.ts     # Creation des ennemis
    |   |-- ProjectileFactory.ts# Creation des projectiles
    |   |-- PickupFactory.ts    # Creation des pickups (XP gems)
    |-- scripts/                # Comportements PlayCanvas (par entite)
    |   |-- PlayerController.ts # Mouvement + visee du joueur
    |   |-- CameraFollow.ts     # Camera top-down smooth
    |   |-- EnemyAI.ts          # IA ennemie (marche vers le joueur)
    |   |-- Projectile.ts       # Mouvement des projectiles
    |   |-- Health.ts           # Systeme de HP/degats/mort
    |   |-- XPPickup.ts         # Gems XP avec attraction magnetique
    |   |-- DayNightCycle.ts    # Cycle jour/nuit
    |-- systems/                # Logique cross-entites
    |   |-- CollisionSystem.ts  # Detection de collisions (spatial hash grid)
    |   |-- CombatSystem.ts     # Armes, auto-attack, cooldowns
    |   |-- WaveSystem.ts       # Spawn des vagues d'ennemis
    |   |-- XPSystem.ts         # XP, niveaux, level-up
    |   |-- UpgradeSystem.ts    # Systeme d'ameliorations
    |   |-- ShopSystem.ts       # Boutique en jeu
    |-- data/                   # Configuration pure (stats, definitions)
    |   |-- characters.ts       # Definition des personnages
    |   |-- weapons.ts          # Definition des armes
    |   |-- enemies.ts          # Definition des ennemis
    |   |-- upgrades.ts         # Definition des ameliorations
    |   |-- waves.ts            # Configuration des vagues
    |-- ui/                     # Interface HTML/CSS overlay
        |-- UIManager.ts        # Gestionnaire central de l'UI
        |-- screens/            # Ecrans (menu, HUD, level-up, etc.)
        |-- styles/
            |-- ui.css          # Styles de l'UI
```

---

## Architecture

### Decisions techniques

| Decision | Raison |
|----------|--------|
| **Pas de moteur physique** (ammo.js) | Centaines de projectiles = trop lourd. Collisions manuelles par distance check + spatial hash grid. |
| **UI en HTML/CSS overlay** | Construire des menus avec le systeme UI PlayCanvas en code pur est tres verbeux. HTML/CSS est plus rapide a developper. |
| **Factory functions** | Pattern idiomatique PlayCanvas : composition via composants, pas heritage. |
| **Systems = classes simples** | Logique cross-entites avec ordre d'execution explicite dans la game loop. |
| **Data-driven** | Personnages, armes, ennemis, upgrades = objets config. Modifier le balancing = changer des nombres dans `src/data/`. |

### Game Loop

A chaque frame (etat `PLAYING`) :

1. **InputManager** -- lecture des inputs (clavier/souris/gamepad)
2. **Scripts PlayCanvas** -- s'executent automatiquement (PlayerController, EnemyAI, Projectile, CameraFollow, DayNightCycle)
3. **CollisionSystem** -- detection de collisions via spatial hash grid
4. **CombatSystem** -- cooldowns des armes, auto-fire des projectiles
5. **WaveSystem** -- spawn des ennemis selon la vague en cours
6. **XPSystem** -- verification des seuils de level-up
7. **UI HUD** -- mise a jour des barres de vie, XP, etc.

### Communication entre systemes

Les systemes communiquent via le bus d'evenements PlayCanvas :

```typescript
// Quand un ennemi meurt
app.fire('enemy:died', entity, xpReward);

// Quand le joueur monte de niveau
app.fire('player:levelup', level);

// Ecouter un evenement
app.on('enemy:died', (entity, xp) => { ... });
```

---

## Ajouter du contenu

### Ajouter un personnage

Editer `src/data/characters.ts` :

```typescript
{
    id: 'nouveau_perso',
    name: 'Nom Affiche',
    description: 'Description courte.',
    hp: 100,
    speed: 8,
    startingWeaponId: 'executive_order', // id d'une arme existante
    color: new pc.Color(r, g, b), // couleur placeholder (0-1)
}
```

### Ajouter une arme

Editer `src/data/weapons.ts` :

```typescript
{
    id: 'mon_arme',
    name: 'Nom Affiche',
    damage: 10,
    cooldown: 0.5,           // secondes entre chaque tir
    pattern: 'single',       // 'single' | 'spread' | 'area' | 'orbit'
    projectileSpeed: 20,
    projectileLifetime: 2.0,
    spreadCount: 3,          // pour pattern 'spread'
    spreadAngle: 30,         // pour pattern 'spread' (degres)
    areaRadius: 4,           // pour pattern 'area'
}
```

### Ajouter un type d'ennemi

Editer `src/data/enemies.ts` :

```typescript
{
    id: 'mon_ennemi',
    name: 'Nom Affiche',
    hp: 30,
    speed: 4,
    damage: 15,              // degats de contact
    xpReward: 20,
    color: new pc.Color(r, g, b),
    scale: 1.0,
}
```

### Ajouter un modele 3D

1. Telecharger le modele au format `.glb` (GLB/glTF)
2. Placer le fichier dans `public/assets/models/`
3. Mettre a jour la factory correspondante pour charger le modele au lieu du placeholder

---

## Controles

| Action | Clavier/Souris | Gamepad |
|--------|---------------|---------|
| Se deplacer | WASD / Fleches | Stick gauche |
| Viser | Souris | Stick droit |
| Tirer | Auto (+ clic gauche) | Auto (+ RT) |
| Interagir | E | A |
| Pause | Echap | Start |

---

## Scripts npm

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de dev avec hot reload |
| `npm run build` | Build de production dans `dist/` |
| `npm run preview` | Preview du build de production |
