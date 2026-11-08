# Personnages du jeu DigiRiskGame

Ce dossier regroupe les personnages principaux du jeu (en lien avec les issues [#20](https://github.com/Evarisk/digiriskgame/issues/20) et [#21](https://github.com/Evarisk/digiriskgame/issues/21)). Chaque personnage dispose de son propre sous-dossier contenant son script de génération 3D, son modèle `.glb` animé, sa fiche descriptive et sa visionneuse 3D autonome.

## Liste des personnages

| # | Personnage | Rôle | Sous-dossier | Modèle 3D | Visionneuse autonome |
| --- | --- | --- | --- | --- | --- |
| 1 | **Riskick** | Incarnation du danger et des risques (Méchant) | [`riskick/`](./riskick/) | [`riskick-v1.glb`](./riskick/riskick-v1.glb) | [`riskick/riskick.html`](./riskick/riskick.html) (`/riskick.html`) |
| 2 | **Le Préventeur Guy** | Allié de la prévention DigiRisk (Gentil) | [`preventeur-guy/`](./preventeur-guy/) | [`preventeur-guy-v1.glb`](./preventeur-guy/preventeur-guy-v1.glb) | [`preventeur-guy/preventeur-guy.html`](./preventeur-guy/preventeur-guy.html) (`/preventeur-guy.html`) |

## Régénérer les modèles 3D et les visionneuses

```bash
npm run build:personnages
```
