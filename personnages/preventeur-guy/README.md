# 2. Le Préventeur Guy — L'allié de la prévention

**Le Préventeur Guy** est le deuxième personnage du jeu DigiRiskGame : le préventeur / travailleur sympathique qui accompagne l'évaluation des risques (DUER) et la mise en place des mesures de prévention face à Riskick.

## Échelle dans le jeu

- **Taille du Préventeur Guy** : **1,75 m** (soit **3× la taille de Riskick** qui mesure `0,583 m`).

## Planches de référence incluses dans le dossier

- [`guy-face_profil.png`](./guy-face_profil.png) : Vue de face et de profil (visage allongé, houppette brune à 3 mèches, barrette grise sur la tempe, pull bleu-violet, gilet jaune haute visibilité à 2 bandes réfléchissantes, pantalon gris-bleu, chaussures de sécurité montantes à liseré jaune).
- [`Guy_action sans EPI.png`](./Guy_action sans EPI.png) : 6 postures d'action sans EPI (salut, explication, inspection à la loupe, prise de notes sur porte-bloc, alerte, stop).
- [`Guy_action avec EPI.png`](./Guy_action avec EPI.png) : 6 postures d'action avec EPI complets (casque jaune, lunettes de protection, casque antibruit orange/noir, gants de protection).

## Animations embarquées (`preventeur-guy-v1.glb`)

1. **`Walk` (Marche — 0,96 s)** : Cycle de marche humain complet articulant hanches (`Leg_L`, `Leg_R`), genoux (`Knee_L`, `Knee_R`), chevilles (`Ankle_L`, `Ankle_R`), torse (`Torso`), bras (`Arm_L`, `Arm_R`), avant-bras (`Forearm_L`, `Forearm_R`) et tête (`Head`).
2. **`Idle` (Au repos — 2,4 s)** : Respiration calme, regard attentif et porte-bloc DUER en main.
3. **`Inspect` (Contrôle DUER — 2,4 s)** : Guy consulte son porte-bloc d'évaluation des risques et salue amicalement de la main droite.

## Fichiers du dossier

- [`create-preventeur-guy.mjs`](./create-preventeur-guy.mjs) : Générateur Three.js du modèle 3D (avec groupe `PPE_Head` et gants `PPE_Glove_L/R` activables) et des animations.
- [`preventeur-guy-v1.glb`](./preventeur-guy-v1.glb) : Modèle 3D binaire glTF 2.0 (1,75 m) avec ses 3 clips d'animation.
- [`viewer.html`](./viewer.html) & [`preventeur-guy.html`](./preventeur-guy.html) : Visionneuse 3D interactive (avec modes **En ronde**, **Sur place**, clic au sol pour marcher, et bouton **EPI : Sans / Avec**).
