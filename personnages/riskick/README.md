# 1. Riskick — L'incarnation du danger

**Riskick** est le premier personnage du jeu DigiRiskGame : une créature orange espiègle qui incarne le danger et les risques professionnels non maîtrisés.

## Identité visuelle

- **Silhouette** : Corps trapu orange vif (`#ed501b`), badge triangulaire d'alerte jaune (`#ffbb08`) riveté sur la poitrine avec point d'exclamation (`!`).
- **Tête** : Sourire narquois à sept dents sculptées, yeux jaunes en amande sous d'épais sourcils froncés, cornes recourbées rayées noir et jaune de signalisation, pointes latérales et crête sur le sommet du crâne.
- **Membres** : Bras dotés de gants sombres à trois doigts et pouce ; jambes articulées aux hanches (`Leg_L`, `Leg_R`) et aux chevilles (`Ankle_L`, `Ankle_R`).

## Animations embarquées (`riskick-v1.glb`)

1. **`Idle` (Au repos — 2,4 s)** : Respiration du torse (compression/extension), léger balancement des bras et regard narquois de gauche à droite.
2. **`Taunt` (Provocation — 2,0 s)** : Petits sauts sur place, bras levés menaçants et hochements de tête.
3. **`Walk` (Marche — 0,92 s)** : Cycle de marche complet à 36 clés :
   - **Foulée et levé de pied** : flexion/extension des hanches (`Leg_L`, `Leg_R`), levé vertical pendant la phase d'oscillation et déroulé complet de la cheville (`Ankle_L`, `Ankle_R` : attaque du talon, appui, poussée des orteils).
   - **Bassin et torse (`Torso`, `Body`)** : rebond vertical à double fréquence (2 pas par cycle), transfert de poids gauche/droite (dandinement), contre-rotation des épaules et légère inclinaison vers l'avant.
   - **Bras (`Arm_L`, `Arm_R`)** : balancement croisé en opposition avec les jambes.
   - **Tête (`Head`)** : suivi du rebond avec léger déphasage et stabilisation du regard.

## Fichiers du dossier

- [`create-riskick.mjs`](./create-riskick.mjs) : Générateur procédural Three.js du modèle et des animations.
- [`riskick-v1.glb`](./riskick-v1.glb) : Modèle 3D binaire glTF 2.0 avec ses 3 clips d'animation.
- [`viewer.html`](./viewer.html) : Gabarit de la visionneuse 3D (avec mode marche **En ronde**, **Sur place**, ou déplacement au clic sur le plateau).
- [`riskick.html`](./riskick.html) : Visionneuse 3D autonome (ouvrable directement en double-cliquant sur le fichier ou via `/riskick.html`).
