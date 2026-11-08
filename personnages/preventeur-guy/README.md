# 2. Le Préventeur Guy — L'allié de la prévention

**Le Préventeur Guy** est le deuxième personnage du jeu DigiRiskGame : l'interlocuteur bienveillant et engagé qui accompagne l'évaluation des risques (DUER) et la mise en place des mesures de prévention face à Riskick.

## Identité visuelle

- **Visage et coiffure** : Visage souriant et rassurant, sourcils arqués chaleureux, coiffure brune à houppettes dynamiques inspirée du personnage emblématique du jeu de cartes Prévention Evarisk.
- **Tenue de terrain** :
  - Pull de travail bleu (`#245699`) sur col de chemise blanc.
  - **Gilet haute visibilité jaune (`#f2cc15`)** à bandes réfléchissantes grises et écusson vert de prévention sur la poitrine.
  - Pantalon de travail bleu marine (`#273549`) et chaussures de sécurité renforcées (`#2b211b`).
- **Accessoire** : Tablette / dossier **DUER DigiRisk** (`Tablet_DUER`) tenue dans la main gauche.

## Animations embarquées (`preventeur-guy-v1.glb`)

1. **`Idle` (Au repos — 2,4 s)** : Respiration calme, regard attentif et posture ouverte avec la tablette DUER en main.
2. **`Inspect` (Contrôle DUER — 2,4 s)** : Guy consulte sa tablette d'évaluation des risques et salue amicalement de la main droite.
3. **`Walk` (Marche — 0,96 s)** : Cycle de marche humain complet à 36 clés articulant hanches (`Leg_L`, `Leg_R`), genoux (`Knee_L`, `Knee_R`), chevilles (`Ankle_L`, `Ankle_R`), torse (`Torso`), bras (`Arm_L`, `Arm_R`), avant-bras (`Forearm_L`, `Forearm_R`) et tête (`Head`).

## Fichiers du dossier

- [`create-preventeur-guy.mjs`](./create-preventeur-guy.mjs) : Générateur procédural Three.js du modèle et des animations.
- [`preventeur-guy-v1.glb`](./preventeur-guy-v1.glb) : Modèle 3D binaire glTF 2.0 avec ses 3 clips d'animation.
- [`viewer.html`](./viewer.html) : Gabarit de la visionneuse 3D (avec mode marche **En ronde**, **Sur place**, ou déplacement au clic sur le plateau).
- [`preventeur-guy.html`](./preventeur-guy.html) : Visionneuse 3D autonome (ouvrable directement en double-cliquant sur le fichier ou via `/preventeur-guy.html`).
