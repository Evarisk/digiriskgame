# 1. Riskick — L'incarnation du danger

**Riskick** est le premier personnage du jeu DigiRiskGame : une créature espiègle qui incarne le danger et les risques professionnels non maîtrisés (« *Tu remets à demain ? Moi, je reste !* »).

## Échelle dans le jeu (1/3 d'un humain / Guy)

- **Taille d'un humain / Le Préventeur Guy** : **1,75 m**
- **Taille de Riskick (1/3)** : **0,583 m** (`58,3 cm`, soit un facteur `×0,3431` appliqué sur le nœud racine `Armature` du modèle Mixamo de 1,70 m).

## Modèle 3D avec squelette Mixamo et planches de référence

Le modèle 3D provient de [`Riskick-animated-mixamo.glb`](./Riskick-animated-mixamo.glb) (`Meshy_AI_Mischief_Monster_20261108_animated_mixamo_All_animation.glb` : 14 104 sommets, armature Mixamo complète à 28 os `mixamorig:*` et 8 animations).

### Planches visuelles incluses dans le dossier
- [`Riskick-face-profil.png`](./Riskick-face-profil.png) : Vue de face et de profil.
- [`Riskick-grand-10cm.png`](./Riskick-grand-10cm.png) : Visuel principal « *Tu remets à demain ? Moi, je reste !* ».
- [`riskick.jpg`](./riskick.jpg) : Postures clés (*Au repos*, *Danger ignoré*, *Repéré !*, *Danger supprimé*, *Contrarié*).
- [`riskick-2.png`](./riskick-2.png) : Nouvelles postures (*En marche*, *En course*, *À l'affût*, *Caché*, *Victoire*, *Provocation*, *En fuite*, *Déséquilibre*).

## 8 Animations Mixamo embarquées (`riskick-v1.glb`)

1. **`Walking` (Marche — 1,03 s)** : Cycle de marche complet sur le squelette Mixamo.
2. **`Running` (Course — 0,63 s)** : Course rapide.
3. **`Cheer_with_Both_Hands_1` (Provocation — 2,17 s)** : Provocation / espièglerie.
4. **`Cheer_with_Both_Hands` (Victoire — 2,93 s)** : Célébration bras levés.
5. **`_360_Power_Spin_Jump` (Saut 360° — 3,03 s)** : Saut acrobatique avec rotation.
6. **`Hang_and_Push_with_Foot` (Coup de pied — 1,13 s)** : Poussée du pied.
7. **`Knock_Down_1` (Neutralisé / K.O. — 3,27 s)** : Danger neutralisé.
8. **`Upside_Down_Rope_Hang_1` (Suspendu — 2,73 s)** : Posture suspendue tête en bas.

## Fichiers du dossier

- [`Riskick-animated-mixamo.glb`](./Riskick-animated-mixamo.glb) : Modèle 3D source avec squelette Mixamo et les 8 animations.
- [`create-riskick.mjs`](./create-riskick.mjs) : Script appliquant l'échelle `1/3` (`0,583 m`) sur le modèle Mixamo et générant [`riskick-v1.glb`](./riskick-v1.glb).
- [`riskick-v1.glb`](./riskick-v1.glb) : Modèle 3D final à l'échelle `1/3` prêt pour le jeu et la visionneuse.
- [`viewer.html`](./viewer.html) & [`riskick.html`](./riskick.html) : Visionneuse 3D autonome permettant de jouer les 8 animations, de basculer entre **En ronde** et **Sur place**, de cliquer au sol pour faire marcher/courir Riskick, et d'afficher le **Repère taille Guy (×3)**.
