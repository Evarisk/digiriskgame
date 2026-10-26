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

## Déploiement direct sur serveur web (o2switch / Apache / PHP) — Sans npm

Le dossier `dist/` pré-compilé, le fichier `.htaccess` et le relais `api-proxy.php` sont inclus dans le dépôt :

```bash
git clone -b develop https://github.com/Evarisk/digiriskgame.git
cd digiriskgame
cp .env.example .env
# Renseignez VITE_DOLAPIKEY dans le fichier .env (ou directement via le bouton clé dans l'interface)
```

## Connexion à un Dolibarr local

Renseignez l'instance locale dans `.env` (le proxy Vite et le script de synchronisation la lisent) :

```bash
VITE_DIGIRISK_BASE_URL=http://localhost/dolibarr/htdocs/api/index.php
VITE_DIGIRISK_PUBLIC_URL=http://localhost/dolibarr/htdocs
VITE_DOLAPIKEY=<clé API de l'utilisateur>
```

Côté Dolibarr : module API REST activé, et pour l'utilisateur de la clé les droits en lecture
`digiriskdolibarr` (API, éléments, risques, signalisations) et `projet` (lecture des tâches, voir tous les projets),
plus `societe > client > voir` pour lister les tâches du plan d'actions.
En développement, le serveur Vite émule aussi le mode photo de `api-proxy.php` (photos des cotations).

## Modèles 3D

- Le type de chaque bâtiment (bureaux, usine, atelier peinture, entrepôt) et de chaque poste (soudure, cisaille, cabine poudre, cariste, VRP, salon...) est déduit des libellés DigiRisk (`src/services/archetypes.js`).
- Les modèles sont procéduraux (`src/components/3d/models/`) et leur géométrie statique est fusionnée (`MergeStatic`) pour limiter les draw calls ; tout élément animé porte `userData={DYNAMIC}`.
- Galerie de revue : `http://localhost:5173/?galerie` (filtres : `bureaux`, `production`, `peinture`, `logistique`, `batiments` ou un archétype, ex. `?galerie=welding`).
- Les drapeaux du rond-point affichent le logo de la société configuré dans Dolibarr (`entity_logo` de `risks/creation-options`), à défaut un monogramme.

## Commandes de développement local (Node.js)

```bash
# Synchroniser le snapshot JSON depuis l'API demodoli.digirisk.com
npm run sync:digirisk

# Lancer le serveur de développement (http://localhost:5173)
npm run dev
```
