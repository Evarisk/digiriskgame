# DigiRiskGame — Jumeau Numérique Interactif connecté à DigiRisk / Dolibarr

Jumeau numérique 3D WebGL temps réel (**React + Vite + React Three Fiber + Drei**) connecté à l'API REST de `demodoli.digirisk.com`.

## Architecture des 5 étapes implémentées

1. **Flux API REST DigiRisk (`scripts/fetch-digirisk.mjs` & `src/services/digiriskApi.js`)**
   - Connexion aux endpoints `/digiriskdolibarr/digiriskelements/tree`, `/digiriskdolibarr/risks`, `/digiriskdolibarr/riskassessments`, `/digiriskdolibarr/risks/creation-options` et `/tasks` sur `https://demodoli.digirisk.com/htdocs/api/index.php`.
   - Extraction de l'entité `MetalOandCo-Industrie` (`GP5 Industrie Standard`), des 4 bâtiments (`GP1 Bureaux`, `GP2 Production`, `GP3 Peinture`, `GP4 Logistique`), des 15 Unités de Travail (`UT`), des 59 risques INRS, des 119 cotations et des 166 tâches du plan d'actions.
2. **Mode « Boîtes Blanches » (Low-Poly / Maquette)**
   - Bascule temps réel dans la barre supérieure pour afficher les bâtiments et ateliers sous forme de volumes architecturaux épurés.
3. **Mode « Assets 3D Métiers » & Coloration par Criticité**
   - Équipements 3D dédiés par type d'UT (postes de soudure avec étincelles, chariot élévateur cariste, cabine de peinture, cuves d'épuration/dépotage, quais logistiques, bureaux et baies serveurs).
   - Coloration dynamique selon l'échelle officielle DigiRisk (`0–47` Vert/Faible, `48–50` Orange/Modéré, `51–80` Rouge/Élevé, `81–100` Rouge Critique + gyrophare 3D).
4. **Cinématique des Flux (Opérateurs Animés)**
   - 5 agents humanoïdes articulés avec EPI se déplaçant en boucle le long de courbes de CatmullRom entre les Unités de Travail (ex. `UT14 Soudeurs ↔ UT8 Bureau d'études`, `UT17 Cariste ↔ UT12 Fret aérien`).
5. **IHM & Raycasting (Sidebar Interactive)**
   - Clic 3D sur n'importe quel atelier ou bâtiment pour cibler la caméra et ouvrir le détail des risques INRS (pictogrammes officiels, cotations Brute vs Résiduelle, 5 critères avancés `Gravité`, `Exposition`, `Occurrence`, `Formation`, `Protection`) ainsi que le Plan d'Actions (`TKx`, avancement `%` et budget `€`).

## Commandes

```bash
# Synchroniser le snapshot JSON depuis l'API demodoli.digirisk.com
npm run sync:digirisk

# Lancer le serveur de développement (http://localhost:5173)
npm run dev
```
