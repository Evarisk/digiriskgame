# 1. Riskick — L'incarnation du danger

**Riskick** est le premier personnage du jeu DigiRiskGame : une créature espiègle qui incarne le danger et les risques professionnels non maîtrisés (« *Tu remets à demain ? Moi, je reste !* »).

## Échelle dans le jeu (1/3 d'un humain / Guy)

- **Taille d'un humain / Le Préventeur Guy** : **1,75 m**
- **Taille de Riskick (1/3)** : **0,583 m** (`58,3 cm`, soit un facteur `×5,8333` appliqué au modèle original de 10 cm `Riskick-grand-10cm.glb`).

## Modèle 3D et planches de référence

Le modèle 3D provient directement de [`Riskick-grand-10cm.glb`](./Riskick-grand-10cm.glb) (306 686 sommets, 577 290 triangles, 3 textures PBR intégrées : couleur, rugosité/métal, normales), équipé d'une armature squelettique glTF 2.0 (`RiskickArmature` : `Root`, `Torso`, `Head`, `Arm_R`, `Arm_L`, `Leg_R`, `Ankle_R`, `Leg_L`, `Ankle_L`) avec lissage Laplacien des poids sur le maillage.

### Planches visuelles incluses dans le dossier
- [`Riskick-face-profil.png`](./Riskick-face-profil.png) : Vue de face et de profil.
- [`Riskick-grand-10cm.png`](./Riskick-grand-10cm.png) : Visuel principal « *Tu remets à demain ? Moi, je reste !* ».
- [`riskick.jpg`](./riskick.jpg) : Postures clés (*Au repos*, *Danger ignoré*, *Repéré !*, *Danger supprimé*, *Contrarié*).
- [`riskick-2.png`](./riskick-2.png) : Nouvelles postures (*En marche*, *En course*, *À l'affût*, *Caché*, *Victoire*, *Provocation*, *En fuite*, *Déséquilibre*).

## Animations embarquées (`riskick-v1.glb`)

1. **`Walk` (Marche — 0,88 s)** : Cycle de marche complet articulé sur le modèle 3D texturé (flexion/extension des hanches `Leg_L`/`Leg_R`, levé de pied, déroulé des chevilles `Ankle_L`/`Ankle_R`, rebond et dandinement du torse `Torso`, balancement des bras `Arm_L`/`Arm_R` et suivi de la tête `Head`).
2. **`Idle` (Au repos — 2,4 s)** : Respiration, regard espiègle et mouvement de la main levée.
3. **`Taunt` (Provocation — 2,0 s)** : Petits sauts et provocation.

## Fichiers du dossier

- [`Riskick-grand-10cm.glb`](./Riskick-grand-10cm.glb) : Modèle 3D haute résolution source (10 cm).
- [`create-riskick.mjs`](./create-riskick.mjs) : Script de mise à l'échelle `1/3` (0,583 m), rigging squelettique (`JOINTS_0` / `WEIGHTS_0`) et génération des animations.
- [`riskick-v1.glb`](./riskick-v1.glb) : Modèle 3D final à l'échelle `1/3` avec squelette et animations.
- [`viewer.html`](./viewer.html) & [`riskick.html`](./riskick.html) : Visionneuse 3D interactive (avec modes **En ronde**, **Sur place**, clic au sol pour marcher, et bouton **Repère taille Guy ×3**).
