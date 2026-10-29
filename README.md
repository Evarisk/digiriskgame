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
4. **Cinématique des Flux (Opérateurs Animés et camions de livraison)**
   - Les opérateurs sont les **salariés de l'entité** (comptes Dolibarr actifs marqués « salarié », hors comptes techniques) : chacun est rattaché à l'UT qui correspond le mieux à son poste (ex. « Conducteur chariot » → Cariste, « Comptable » → Administratif et finance) et fait l'aller-retour vers une UT d'un autre bâtiment par les couloirs piétons (`src/services/employees.js`, 8 opérateurs au plus). Sans accès à la liste des salariés, des « Opérateurs » anonymes les remplacent.
   - Une **semi-remorque par entrepôt** quitte son quai, roule sur la voirie du site (rond-point, portail du poste de garde) jusqu'à la route départementale, puis revient se mettre à quai en marche arrière (`src/components/3d/DeliveryTrucks.jsx`). Elle met ses clignotants (au rond-point : à gauche en entrant pour tourner à gauche, à droite avant de sortir), ralentit en virage, attend la levée de la barrière et s'arrête devant un piéton ou le joueur en visite.
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
plus `societe > client > voir` pour lister les tâches du plan d'actions,
et `Utilisateurs > Consulter les autres utilisateurs` pour placer les salariés sur le site (seuls le nom, le prénom et le poste sont lus ; le relais `api-proxy.php` ne laisse passer que ces champs).
En développement, le serveur Vite émule aussi le mode photo de `api-proxy.php` (photos des cotations).

**Multisociété** : l'entité affichée se choisit dans *Paramètres* (en-tête `DOLAPIENTITY`, choix mémorisé dans le navigateur).
La liste des entités demande le droit de lecture du module multisociété. L'API DigiRisk ne lit une autre entité que pour
un utilisateur API global (entité 0) ; en mode transverse, il doit aussi être membre d'un groupe dans chaque entité, avec
les droits de lecture ci-dessus. Une entité inaccessible est signalée dans *Paramètres* sans basculer sur le DUER de démonstration.

## Modèles 3D

- Le type de chaque bâtiment (bureaux, usine, atelier peinture, entrepôt) et de chaque poste (soudure, cisaille, cabine poudre, cariste, VRP, salon...) est déduit des libellés DigiRisk (`src/services/archetypes.js`).
- **Plan du site calculé pour n'importe quel nombre de GP et d'UT** (`src/services/siteLayout.js`) :
  - chaque GP de premier niveau est un bâtiment, ses UT rangées en grille presque carrée ; un sous-groupement commence une nouvelle rangée et forme une zone repérée au sol (à toute profondeur) ;
  - les UT rattachées directement à la racine sont regroupées dans une *Zone extérieure* ;
  - les bâtiments forment des îlots en grille autour du rond-point central, séparés par des voies ; enceinte, caméra, ombres, terrain et minicarte suivent la taille du site ;
  - les couloirs piétons (intérieurs, le long des voies, portes, passages piétons) forment un graphe : il sert au dessin et aux trajets des opérateurs ;
  - le rond-point central a un anneau de circulation (couloirs piétons et passages piétons au-delà) ; devant le portail, une route départementale part dans le brouillard ; le plan calcule aussi les trajets des camions de livraison (`site.deliveries`).
- Ciel de jour (dégradé, halo du soleil, nuages low-poly qui dérivent hors de la vue plongeante) et brume claire à l'horizon (`src/components/3d/SkyDome.jsx`).
- Les modèles sont procéduraux (`src/components/3d/models/`) et leur géométrie statique est fusionnée (`MergeStatic`) pour limiter les draw calls : les postes d'un bâtiment sont fusionnés ensemble, et les pièces du kit qui ne diffèrent que par leur couleur, rugosité ou lueur partagent un maillage (valeurs reportées dans les sommets). Tout élément animé porte `userData={DYNAMIC}`, de même que tout groupe dont le code d'animation modifie un enfant.
- **Extincteurs et trousses de secours** : au survol (ou en visant en visite), une infobulle donne la dernière et la prochaine vérification et le statut (à jour, à prévoir sous 30 jours, en retard). Ces dates sont pour l'instant des données de démonstration (`src/services/equipmentChecks.js`), signalées comme telles.
- Galerie de revue : `http://localhost:5173/?galerie` (filtres : `bureaux`, `production`, `peinture`, `logistique`, `batiments` (tous les skins de bâtiment) ou un archétype, ex. `?galerie=welding`).
- Les drapeaux du rond-point affichent le logo de la société configuré dans Dolibarr (`entity_logo` de `risks/creation-options`), à défaut un monogramme.
- **Paramètres** : choix de l'entité Dolibarr (multisociété, voir plus haut) et skins.
- **Skins** (bouton *Paramètres*) : chaque groupement peut prendre une autre enveloppe et finition (bureaux verre bleu / bronze / vert, usine brique / acier / béton, peinture blanc / anthracite / sable, entrepôt gris / bleu / vert) et chaque unité de travail n'importe lequel des 24 modèles de poste. « Auto » suit le libellé ; les choix sont mémorisés dans le navigateur (`src/services/skins.js`).

## Visite en première personne

Bouton *Visite 1re pers.* (souris + clavier requis) : on parcourt le site à hauteur d'homme avec une tablette DigiRisk en main.

- ZQSD / WASD ou flèches pour se déplacer, souris pour regarder, Maj pour courir, Espace pour sauter, Échap pour la pause.
- E ou clic : inspecte l'élément visé (UT, groupement, entité) et ouvre sa fiche risques.
- **Mission guidée « Visite de sécurité »** : inspecter chaque poste de travail (UT). Un briefing l'explique au départ ; le panneau de mission et la tablette indiquent le prochain poste (le plus proche non inspecté), sa direction et sa distance, et la consigne du moment (se déplacer, viser, appuyer sur E). Une balise bleue, visible à travers les murs, flotte au-dessus du poste. Chaque inspection est confirmée ; la carte de pause liste les postes par bâtiment et la minicarte les marque en vert.
- Une alerte s'affiche à l'entrée d'une UT à risque élevé ou critique. En pause, choisir un élément dans l'arborescence y téléporte le joueur.
- Les collisions utilisent la géométrie réelle des modèles (BVH `three-mesh-bvh`, `src/components/3d/explorer/`) ; un objet sans collision (volume holographique, fumée...) porte `userData={{ noCollide: true }}`.

## Commandes de développement local (Node.js)

```bash
# Synchroniser le snapshot JSON depuis l'API demodoli.digirisk.com
npm run sync:digirisk

# Lancer le serveur de développement (http://localhost:5173)
npm run dev
```
