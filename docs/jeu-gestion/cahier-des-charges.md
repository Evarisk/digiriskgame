# Cahier des charges — Jeu de gestion « Objectif Prévention » (titre de travail)

Destinataire : agent de développement travaillant dans ce dépôt (`digiriskgame`).
Contexte des idées et alternatives écartées : [`idees.md`](idees.md). Ce cahier des charges fait foi en cas d'écart.

---

## 0. À lire avant de commencer

- **Ce qu'on construit** : un jeu de gestion / stratégie **en temps réel avec pause** (genre Age of Empires, Anno,
  Settlers) sur le site 3D du jumeau numérique. Le joueur est le préventeur de l'entreprise. Il gère quatre
  dimensions : **l'argent**, **l'envie des salariés**, **les risques** et les **niveaux de maîtrise**.
- **Jeu original** : on reprend des mécaniques de genre (affecter des travailleurs, poser des constructions,
  rechercher, franchir des paliers). On ne reprend aucun nom, visuel, son, unité ou interface d'un jeu existant.
- **État** : une V1 a été prototypée sur `/aoe` puis retirée du dépôt (novembre 2026, à la demande de l'équipe). Une
  nouvelle version, **Cité Prévention**, occupe désormais `/aoe` : elle reprend d'abord les principes du genre avec les
  bâtiments de l'éditeur et quatre indicateurs standard (DU fait, salariés sensibilisés, accidents, registres
  remontés), testée avec des personas — voir [`../jeu-aoe/regles.md`](../jeu-aoe/regles.md) et
  [`../jeu-aoe/personas.md`](../jeu-aoe/personas.md). Le présent cahier (DUER réel, envie, cotations) reste la cible
  des lots suivants ; ses valeurs chiffrées sont celles du premier prototype.
- **Livraison par lots** (§ 7). Chaque lot se termine par ses critères d'acceptation, une page jouable, le README mis à
  jour, `npm run build` réussi et le dossier `dist/` reconstruit (convention du dépôt).
- **Conventions du dépôt** à respecter :
  - JavaScript + JSX (pas de TypeScript), React 18, `@react-three/fiber` 8, `@react-three/drei` 9, `three` 0.169,
    icônes `lucide-react`. **Aucune nouvelle dépendance d'exécution.**
  - Textes d'interface **et commentaires en français**, avec la même densité de commentaires que le code voisin.
  - État partagé entre le Canvas et le DOM : même patron que `src/components/3d/explorer/explorerStore.js`
    (`useSyncExternalStore`), sans bibliothèque d'état.
  - `localStorage` toujours dans un `try/catch`, comme `src/App.jsx` (`loadSavedEntity`).
  - Code chargé à part avec `lazy()`, comme l'éditeur (`src/main.jsx`) : le jumeau ne télécharge pas le jeu.
  - Git : une branche par lot depuis `develop` (`feat/<issue>-game-<lot>`), commits `#<issue> [Game] feat: …`
    (portées existantes : `[3D]`, `[Build]`, `[Docs]`, `[Explorer]`, `[Dolibarr]`, `[API]`), une PR par lot vers
    `develop`. Le numéro d'issue est fourni par l'équipe.
- **Prérequis** : l'éditeur de site (`feat/1-site-editor`, encore non commité au moment de la rédaction) doit être
  fusionné dans `develop` avant de commencer. Les lots 0 à 2 n'en dépendent pas fonctionnellement ; le lot 3 oui.
- **Lecture seule vers Dolibarr** : le jeu ne crée, ne modifie et ne supprime rien dans Dolibarr / DigiRisk. Toute
  la partie se joue sur une copie locale du DUER. `public/api-proxy.php` n'est pas modifié.

---

## 1. Contexte et objectif

Le dépôt contient un jumeau numérique 3D d'un site d'entreprise, construit à partir du Document Unique (DUER) de
DigiRisk : groupements (GP, des bâtiments), unités de travail (UT), risques par catégorie INRS, cotations 0–100
(critères Gravité, Exposition, Occurrence, Formation, Protection), plan d'actions (tâches avec budget et avancement)
et salariés Dolibarr rattachés à une UT. Il y a aussi une visite en première personne et un éditeur de site.

**Objectif** : transformer ce jumeau en jeu de gestion où l'on apprend en jouant que la prévention est un arbitrage
entre argent, implication des personnes et maîtrise des risques. On peut jouer sur le DUER de démonstration ou sur
**son propre DUER**.

**Public** : clients et prospects DigiRisk (dirigeants, préventeurs, membres du CSE, salariés), en sensibilisation ou en
formation. Ton sérieux mais ludique, sans gore, sans représentation de décès (on parle d'« accident grave »).

**Partie type** : une année d'entreprise (12 mois) en 30 à 45 minutes à vitesse ×1, sur ordinateur (souris + clavier).

---

## 2. L'existant à réutiliser

| Besoin du jeu | Existant | Remarque |
| --- | --- | --- |
| Charger un DUER (démo ou réel) | `src/services/digiriskApi.js` → `loadDigiRiskData()` | Snapshot `src/data/digiriskSnapshot.json` (entité « Industrie Standard », 4 GP, 15 UT, 59 risques, 68 tâches liées). Le snapshot n'a pas de salariés. |
| Échelle de cotation | `getCotationScale()`, `statsFromRisks()` (même fichier) | 0–47 gris (faible), 48–50 orange, 51–80 rouge, 81–100 noir (critique). |
| Plan 3D du site | `src/services/siteLayout.js` → `layoutTwin(hierarchy, skins)` | Donne `buildings`, `site.walkGraph`, `elementsById`, `ut.layout3D` (`worldPosition`, `size`, `walkNode`, `focus`). |
| Type de bâtiment / poste | `src/services/archetypes.js` | 24 archétypes de poste (`welding`, `forklift`, `paint_booth`…). Fichier sans import, utilisable sous Node. |
| Salariés → UT | `src/services/employees.js` → `assignEmployees()` | Correspondance poste / UT déjà écrite. |
| Rendu du site | `BuildingGroup`, `WorkUnitZone` (couleur selon cotation, gyrophare si critique), `CampusScenery`, `SkyDome`, `DeliveryTrucks` | `WorkUnitZone` lit `ut.stats.scaleResiduelle` / `maxResiduelle`. |
| Personnages animés | `src/components/3d/models/people.jsx` (`Person`, tenues, poses, `colors`) ; `WorkerAgents.jsx` (`walkRoute()` sur le graphe piéton) | `walkRoute` est privée : à extraire (§ 6.7). |
| Équipements et vérifications | `src/services/equipmentChecks.js`, `src/components/3d/equipment/equipment.jsx` | Dates de démonstration déterministes (statuts `ok`, `soon`, `late`). |
| Catalogue d'éléments posables | `src/services/editorCatalog.js` (`ELEMENT_KINDS`, catégorie `securite`), `src/components/editor/ElementModel.jsx` | Garde-corps, zone balisée, potelet, extincteur, trousse, douche, panneaux, éclairage, transpalette… |
| Visite à pied | `src/components/3d/explorer/*`, `ExplorerHud.jsx`, `ExplorerMinimap.jsx` | Inspection d'UT (touche E), mission guidée, minicarte. |
| Routage des pages | `src/main.jsx`, `.htaccess` | `/edit` sert de modèle pour `/aoe`. |

---

## 3. Vue d'ensemble du jeu

### Boucle de jeu
1. Le site tourne : les salariés produisent, ce qui fait rentrer de l'argent.
2. Les risques génèrent des **presqu'accidents** (alertes à traiter) et parfois des **accidents**.
3. Le joueur **affecte** des salariés (production, formation, chantier, évaluation), **pose** des protections,
   **achète** des EPI, lance des **recherches** d'organisation et **évalue** les UT.
4. Les cotations baissent (les UT changent de couleur), l'envie évolue, la trésorerie aussi.
5. Une fois les conditions remplies, le joueur paie le passage au **palier de maîtrise** suivant, qui débloque de
   nouvelles mesures.
6. Chaque fin de mois affiche un **bilan**. La partie se termine au palier 4 (victoire), à la fin des 12 mois (score)
   ou sur une défaite.

### Les quatre dimensions en bref
| Dimension | Échelle | Visible où | Rôle |
| --- | --- | --- | --- |
| Argent | € (trésorerie) | Barre du haut, bilan mensuel | Paie tout ; découvert prolongé = défaite |
| Envie | 0–100 par salarié, moyennes UT et site | Barre du haut, pastille au-dessus des têtes, fiches | Module la cadence, le port des EPI, les remontées, les absences, les démissions |
| Risques | Cotation DigiRisk 0–100 par risque | Couleur des UT, gyrophare, listes | Génèrent incidents et accidents |
| Maîtrise | Niveau par risque (4 niveaux) + palier d'entreprise (1 à 4) | Fiches risques, barre du haut | Progression ; débloque le contenu ; condition de victoire |

---

## 4. Règles du jeu

Toutes les valeurs numériques sont des **valeurs initiales** réunies dans `src/game/config.js` (annexe D). Elles
seront réglées avec le script d'équilibrage (§ 8). Les formules, elles, sont normatives.

### 4.1 Temps
- Unité de simulation : le **jour ouvré**. 1 jour = `DAY_SECONDS` = 10 s réelles à ×1 ; 1 mois = 20 jours ;
  1 partie = 12 mois.
- Vitesses : pause, ×1, ×2, ×4. La partie démarre en pause.
- **Pas fixe** de simulation : `SIM_STEP_DAYS = 0.05`. L'interface accumule le temps réel × vitesse et appelle le
  moteur autant de fois que nécessaire (au plus 20 pas par image, au-delà on abandonne le retard).
- Calendrier : la partie commence à la date réelle du jour (ou à une date de scénario) et affiche le mois et l'année
  (« Novembre 2026 »). Cette date sert à juger l'ancienneté des évaluations DigiRisk et à placer la canicule en été.
- Fin de mois (tous les 20 jours) : frais fixes, cotisation AT/MP, entretien des mesures, bilan, sauvegarde auto.

### 4.2 Carte, groupements et unités de travail
- La carte est le plan calculé par `layoutTwin()` sur le DUER chargé. Un GP de premier niveau est un bâtiment, une UT
  est une zone de poste.
- Chaque UT du jeu porte : `archetype` (via `archetypes.js`), facteur de marge (annexe D), date de dernière
  évaluation, mesures en place et salariés rattachés.
- **Date de dernière évaluation initiale** = la plus récente `dateCreation` des évaluations de ses risques DigiRisk.
  Une UT sans risque est « jamais évaluée ». Une évaluation de plus de 365 jours calendaires avant le début de partie
  passe l'UT en **« Évaluation à mettre à jour »** (rappel : mise à jour au moins annuelle du DUER pour les
  entreprises d'au moins 11 salariés).
- Les risques rattachés à un **groupement** (et non à une UT) touchent tous les salariés des UT de ce groupement,
  avec un facteur d'exposition de 0,3 par salarié, plafonné à l'équivalent de 2 personnes. Ceux de l'entité racine touchent tout le site (même facteur).

### 4.3 Salariés (les unités)
- **Source** : `data.employees` (Dolibarr) rattachés par `assignEmployees()`. Au plus `MAX_EMPLOYEES = 30`, en
  gardant d'abord ceux dont le poste correspond à une UT (comme `planWalkers`).
- **Sans salariés lisibles** (snapshot, droits manquants) : le jeu génère une équipe fictive, 2 personnes par UT de
  production, peinture ou logistique et 1 par UT de bureaux, au moins 6 et au plus 30. Noms fictifs (liste fixe de
  prénoms + initiale), poste déduit de l'archétype (Soudeur, Cariste, Peintre, Comptable…), choix déterministe selon
  la graine.
- **Le préventeur** (« Vous ») est une unité spéciale toujours présente. Il ne produit pas. Il évalue les UT, analyse
  les presqu'accidents, anime les causeries et fait des visites terrain.
- **États d'un salarié** : `idle`, `walking`, `working` (production), `training`, `building` (chantier),
  `evaluating` (participe à une évaluation), `absent` (accident, maladie, absentéisme), `gone` (démission).
- **Déplacement** : en ligne droite × 1,3 (détour) côté moteur, à `WALK_UNITS_PER_SECOND = 4` unités de scène par
  seconde réelle à ×1, soit 40 unités par jour. Le rendu 3D anime le trajet le long du graphe piéton (`walkRoute`)
  sur la même durée.
- **Production** : un salarié `working` produit à plein dans **son UT** et à 50 % dans une autre UT.
- **Relais sécurité** (lot 2, palier 3) : un salarié formé avec une envie ≥ 70 peut être nommé relais. Dans son UT, les
  presqu'accidents sont analysés automatiquement et l'envie gagne +3. Au plus 1 relais par UT.

### 4.4 Argent
- **Trésorerie de départ** : `START_CASH` (15 000 € en normal).
- **Recette continue** d'un salarié qui travaille :
  `MARGIN_PER_DAY × facteurArchétype × cadence × (1 si son UT, 0,5 sinon) × dt`,
  avec `cadence = 0,6 + 0,6 × envie / 100` (cadence 1,0 pour une envie de 67).
- **Fin de mois** :
  - frais fixes : `FIXED_COST_PER_EMPLOYEE_MONTH × effectif` (effectif = salariés non partis, préventeur exclu) ;
  - **cotisation AT/MP (modèle simplifié, pédagogique)** : `tauxATMP × PAYROLL_PER_EMPLOYEE_MONTH × effectif`.
    `tauxATMP` part de 2,2 % et se recalcule en fin de trimestre sur les 12 derniers mois de jeu : +0,8 point par
    accident avec arrêt, +3 points par accident grave, +0,8 point par maladie professionnelle, −0,2 point par
    trimestre sans accident avec arrêt à partir du palier 3, plancher 1 % ;
  - entretien mensuel des mesures actives (annexe C).
- **Dépenses ponctuelles** : mesures, formations, EPI et leur renouvellement, recherches, paliers, recrutement
  (3 000 €), amendes, coût direct des accidents (§ 4.7).
- **Refus** : une commande dont le coût dépasse `trésorerie + DECOUVERT_AUTORISE` (10 000 €) est refusée avec le
  message « Trésorerie insuffisante ».
- **Défaite** si la trésorerie reste sous −10 000 € pendant 20 jours consécutifs.

### 4.5 Envie
- **Valeur initiale** : 55 ± 10 (tirage selon la graine), −10 si l'UT d'origine a un risque psychosocial de cotation
  ≥ 51.
- **Évolution continue** vers une cible : `envie += (cible − envie) × 0,08 × dt`, bornée à [0, 100].
- **Cible** = 50 + somme des modificateurs suivants (UT = UT d'origine du salarié) :

| Modificateur | Valeur |
| --- | --- |
| Danger perçu | −0,25 × max(0, cotation résiduelle max de l'UT − 47) |
| Risques psychosociaux | −0,30 × max(0, cotation RPS résiduelle de l'UT − 40) |
| Protections collectives actives dans l'UT | +2 par mesure, au plus +8 |
| EPI imposés dans l'UT | −2 par type, au plus −6 (−1 par type si l'UT a eu une évaluation participative depuis moins de 60 jours) |
| Formé il y a moins de 60 jours | +6 |
| Visite du préventeur dans l'UT depuis moins de 20 jours | +4 |
| Collègues absents | −15 × part d'absents dans l'UT |
| Accident avec arrêt dans le bâtiment depuis moins de 30 jours | −10 (−4 pour le reste du site) |
| Palier de maîtrise | +3 × (palier − 1) |
| Événements en cours | selon l'événement (§ 4.12) |

- **Variations immédiates** : presqu'accident analysé +2 (UT) ; presqu'accident ignoré −1 (UT) ; accident −8 (UT de
  la victime) ; évaluation participative +6 (participants) ; causerie +3 (UT) ; démission d'un collègue −3 (UT).
- **Effets** :
  - cadence (§ 4.4) ;
  - **port des EPI** : `port = clamp((envie − 20) / 50, 0, 1)` ; un EPI ne protège qu'au prorata du port ;
  - **remontée spontanée** : un presqu'accident est analysé tout seul avec une probabilité
    `max(0, (envie − 60) / 40)` (lot 2, avec la recherche « Remontées spontanées » ou un relais) ;
  - **absentéisme** : probabilité d'absence par jour `(1 − envie / 100) × 0,02`, absence de 1 à 3 jours ;
  - **démission** : envie < 15 pendant 10 jours consécutifs → le salarié sort par le portail et passe en `gone` ;
  - **crise sociale** : envie moyenne du site < 25 → 3 jours sans production. Moyenne < 20 pendant 20 jours → défaite.
- **Rendu** : pastille colorée au-dessus de chaque salarié (rouge < 30, orange < 50, jaune < 70, vert au-delà),
  doublée d'une forme pour ne pas reposer sur la seule couleur.

### 4.6 Risques
#### Cotation
- Critères DigiRisk (méthode avancée) : **G** Gravité, **E** Exposition, **O** Occurrence, **F** Formation (1 =
  formé, 4 = pas formé), **P** Protection (1 = protégé, 4 = pas protégé).
- `cotationFromCriteria({G,E,O,F,P})` = interpolation linéaire, selon le produit G×E×O×F×P, dans le tableau de
  l'annexe A. Ce tableau a été déduit des évaluations du snapshot : l'agent vérifie dans un test que les 11 points
  mesurés sont retrouvés exactement. Si la matrice officielle de `digiriskdolibarr` est accessible, l'aligner dessus
  et le signaler dans la PR.
- Les critères peuvent être fractionnaires (effet partiel d'un EPI ou d'une formation) : l'interpolation s'en charge.
  La cotation est arrondie à l'entier le plus proche pour l'affichage et pour les seuils d'échelle.
- **Calibrage initial** : les évaluations « standard » n'ont pas de critères (tous à 1, cotation directe 0 / 48 / 51 /
  100), et certaines évaluations avancées du snapshot sont incohérentes (par exemple (3,1,1,1,1) noté 31). Règle :
  - évaluation avancée cohérente (écart ≤ 3 entre la cotation calculée et la cotation DigiRisk) : on garde ses critères ;
  - sinon, recherche exhaustive sur les 1 280 combinaisons entières (G 1–4, E 0–4, O 1–4, F 1–4, P 1–4). On garde
    celles dont la cotation calculée est **dans le même niveau d'échelle** que la cotation DigiRisk, Évaluation avancée incohérente : la plus proche de sa
    valeur, puis du profil de la famille (annexe B, distance L1, un écart sur G comptant triple). Méthode standard (la
    cotation n'est qu'un choix de niveau 0 / 48 / 51 / 100) : la plus proche du profil, puis de la valeur, sauf au niveau
    faible où l'on reste au plus près de la valeur (un risque coté 0 reste à 0). Le résultat est déterministe.
  La cotation DigiRisk d'origine reste affichée dans la fiche (« Cotation DUER d'origine »).
- **Cotation brute** (dans le jeu) = cotation calibrée au début de la partie. **Cotation résiduelle** = cotation
  courante avec les mesures. Le bouton existant brute / résiduelle garde ce sens.

#### Familles de risques
Chaque risque est classé dans une **famille** de jeu (annexe B) par expression régulière sur le libellé de sa
catégorie DigiRisk, normalisé comme dans `archetypes.js`. La famille donne : le profil de critères par défaut, le
caractère aigu ou chronique, les mesures applicables et les modèles de risques cachés.

#### Risques cachés et évaluation
- Pour chaque UT, les **modèles de risques probables** de son archétype (annexe B) qui ne sont pas déjà présents dans
  le DUER (même famille dans la même UT) deviennent des **risques cachés** (`source: 'latent'`).
- Un risque caché génère des incidents comme les autres. Son incident s'affiche « Danger non identifié ». On ne peut
  pas le traiter tant qu'il n'est pas révélé.
- **Évaluer une UT** (préventeur) : durée `1 + 0,25 × (nombre de risques de l'UT)` jours. Option **participative** :
  les salariés de l'UT y prennent part et ne produisent pas pendant ce temps ; la durée est multipliée par 0,7 et ils
  gagnent +6 d'envie.
- **À la fin de l'évaluation** : la date de l'UT est remise à jour. Chaque risque caché est révélé avec la probabilité
  70 % (+15 en participatif, +10 avec la recherche « Document unique numérique »). La fiche affiche les critères
  exacts.
- **Autres façons de révéler** : analyse d'un presqu'accident sur ce risque (100 %), visite de la médecine du travail
  (TMS, RPS), remontée spontanée, évaluation à pied en 1re personne (lot 3, 100 %).
- **Nouveaux risques** en cours de partie : événement « Machine neuve » (risque connu mais non évalué, à évaluer).

#### Niveau de maîtrise d'un risque (affiché par risque)
| Niveau | Condition (la plus haute satisfaite) |
| --- | --- |
| 0 — Non maîtrisé | Aucune mesure du joueur, ou cotation résiduelle ≥ 81 |
| 1 — Partiellement maîtrisé | Seulement des leviers F (formation, information) ou P individuels (EPI) |
| 2 — Maîtrisé | Au moins une protection collective ou une mesure d'organisation, et cotation résiduelle ≤ 50 |
| 3 — Maîtrise durable | Substitution ou suppression, ou cotation ≤ 30 avec protection collective et ≥ 80 % de salariés formés |

À partir du lot 2, les risques réduits par des tâches DigiRisk déjà terminées (avancement 100 %) au début de la
partie sont au niveau correspondant à la nature de ces tâches (§ 4.9).

### 4.7 Incidents, accidents, maladies
- **Fréquence** : pour chaque risque, par jour : `λ = INCIDENT_BASE × (cotationRésiduelle / 100)² × exposés`.
  `exposés` = salariés `working` dans l'UT du risque (× 0,3 pour un risque de groupement ou de site, au plus 2 personnes, § 4.2).
  Tirage selon la loi de Poisson à chaque pas.
- **Issue d'un incident** (familles aiguës) :

| Issue | Probabilité | Effets |
| --- | --- | --- |
| Presqu'accident | 80 % | Alerte « ! » sur l'UT pendant `NEAR_MISS_TTL = 3` jours de jeu |
| Accident bénin (soins, sans arrêt) | 12 % | 300 € ; −3 d'envie (UT) |
| Accident avec arrêt | 7 % | 6 000 € ; absence de 10 à 30 jours ; −8 d'envie (UT) ; AT/MP |
| Accident grave | 1 % si G ≥ 3 (sinon compté comme accident avec arrêt) | 30 000 € ; absence de 60 à 120 jours ; contrôle de l'inspection déclenché ; AT/MP ; contrôle de faute inexcusable |

  Une trousse de secours dans l'UT réduit coût et absence de 15 %, un SST présent dans le bâtiment de 30 % (cumulables).
- **Presqu'accident** : cliquer sur l'alerte (ou y envoyer le préventeur) l'**analyse**. Effets : révèle le risque
  s'il était caché, +2 d'envie dans l'UT, propose la mesure recommandée (la plus haute dans la hiérarchie parmi celles
  disponibles pour cette famille), +1 au compteur de remontées. Non traité à temps : −1 d'envie dans l'UT.
- **Maladie professionnelle** (familles chroniques, lot 2) : chaque salarié accumule
  `(cotationRésiduelle / 100)² × dt` par risque chronique de son UT. Au-delà de `CHRONIC_THRESHOLD = 60` : maladie
  reconnue (10 000 €, absence de 40 jours, AT/MP, −5 d'envie dans l'UT) et compteur remis à zéro. Pour ces familles,
  les presqu'accidents s'appellent « douleurs signalées ».
- **Faute inexcusable** : accident grave sur un risque (a) connu, de cotation résiduelle ≥ 51 et sans aucune mesure
  engagée, ou (b) caché dans une UT jamais évaluée ou dont l'évaluation date de plus d'un an. En normal : **défaite**.
  En facile : amende de 25 000 €. L'écran de fin explique pourquoi, de façon pédagogique.
- Une **mesure engagée** sur un risque = une mesure active ou en cours (chantier, formation, recherche liée) qui agit
  sur sa famille dans son périmètre, ou une tâche DigiRisk liée en cours de réalisation.

### 4.8 Mesures de prévention
Chaque mesure agit sur des **critères** DigiRisk, pour les **familles** qu'elle cible, dans un **périmètre**
(salarié, UT, bâtiment, site). Elles suivent la hiérarchie des principes généraux de prévention :

| Type | Levier principal | Palier mini | Dépend de l'envie ? | Effet sur l'envie |
| --- | --- | --- | --- | --- |
| Formation / information | F (selon la part de salariés formés) | 1 | Non | +6 pour le salarié formé (60 j) |
| EPI | P × port | 1 | **Oui** (port) | −2 par type (contrainte) |
| Protection collective (EPC) | O et/ou P | 1 ou 2 | Non | +2 par mesure (au plus +8) |
| Organisation | E (avec perte de production) | 2 | Non | selon la mesure |
| Substitution | G | 3 | Non | +5 dans l'UT |
| Suppression | Le risque passe à E = 0 (cotation 0) | 4 | Non | +5 dans l'UT |

- **Calcul des critères effectifs** : `critère = critèreBrut − Σ leviers`, avec des plafonds de réduction (F et P
  −3 au plus, O et E −2, G −2) et des planchers (G, O, F, P ≥ 1 ; E ≥ 0 seulement par suppression).
  - Formation : `levierF = force × partFormée`, où `partFormée` est la part des salariés de l'UT qui ont une formation
    valide ciblant la famille. Les forces se cumulent sous le plafond.
  - EPI : `levierP = force × portMoyen` des salariés de l'UT équipés.
- **Durée de validité** : formations 160 jours de jeu (volontairement raccourcie pour imposer un recyclage dans
  l'année) ; EPI 120 jours, avec une option « renouvellement automatique » par UT (débit automatique).
- **Chantiers d'EPC posables** : on pose l'élément sur la carte (fantôme vert si valide, rouge sinon). Il doit être
  dans l'emprise d'une UT (il agit sur cette UT), ou d'un bâtiment pour les mesures de bâtiment. Deux façons de le
  réaliser :
  - **en interne** : on affecte 1 à 3 salariés ; durée = `jours-hommes / équipe`, et ils ne produisent pas pendant ce temps ;
  - **prestataire** : +50 % de coût, réalisé seul dans le même délai qu'une équipe de 2.
  Annuler un chantier commencé rembourse 50 %.
- Le catalogue initial (environ 35 mesures) est en annexe C. Une mesure se déclare comme une donnée : identifiant,
  libellé, type, familles, leviers, coût, coût par salarié, entretien mensuel, durée, palier, recherche requise,
  élément 3D (`ELEMENT_KINDS`) éventuel et effet sur l'envie.

### 4.9 Plan d'actions DigiRisk (lot 2)
- Les tâches DigiRisk liées à un risque (`risk.tasks`) deviennent des actions jouables, dans l'onglet « Plan
  d'actions » :
  - avancement 100 % : déjà réalisée. Pas de coût, mais elle compte pour le niveau de maîtrise du risque (son levier
    est réputé déjà intégré dans la cotation d'origine) ;
  - avancement < 100 % : action « Terminer TKxxxx » au coût `budget × (1 − avancement / 100)` (au moins 100 €), d'une
    durée de 2 à 10 jours selon le coût, avec un levier tiré de son libellé.
- **Classification du libellé** (normalisé, première règle qui correspond) :
  `former|formation|sensibilis|causerie|informer|accueil` → formation (F −1 sur l'UT) ;
  `gant|casque|lunette|chaussure|gilet|epi|masque|harnais|bouchon` → EPI (P −1) ;
  `installer|garde-corps|eclairage|ventilation|aspiration|carter|barriere|filtre|amenag` → EPC (O −1, P −0,5) ;
  `organis|planning|rotation|teletravail|horaire|procedure|plan de` → organisation (E −1) ;
  `controle|verif|maintenir|entretien|suivi` → maintien (P −0,5, et entretien mensuel de 20 €) ;
  sinon → information (F −0,5).
- C'est le **pont avec la réalité** : le plan d'actions réel de l'entreprise se joue dans la partie.

### 4.10 Recherches « Organisation et méthodes » (lot 2)
Une recherche à la fois, payée au lancement, qui avance en arrière-plan. Exemples (coût, durée en jours, palier) :

| Palier | Recherche | Coût | Durée | Effet |
| --- | --- | --- | --- | --- |
| 1 | Accueil sécurité des nouveaux | 1 500 € | 5 | Les nouveaux arrivants ont la formation « Accueil » |
| 1 | Registre des presqu'accidents | 1 000 € | 4 | Durée des alertes +50 % ; +10 % de révélation par analyse |
| 1 | Vérifications périodiques | 2 000 € | 5 | Contrat annuel : extincteurs et trousses restent à jour |
| 2 | Plan de circulation | 3 000 € | 8 | Effets des allées, zones et potelets ×1,5 sur la circulation interne |
| 2 | Permis feu | 2 000 € | 5 | Incendie O −1 dans les UT de soudure et de peinture |
| 2 | Causeries sécurité | 1 500 € | 5 | Le préventeur peut animer des causeries (F −0,5 pendant 60 j, +3 d'envie) |
| 2 | Document unique numérique | 2 500 € | 6 | Évaluations 2× plus rapides ; +10 % de révélation |
| 3 | Analyse des accidents (arbre des causes) | 3 000 € | 8 | Après un accident : mesure recommandée et perte d'envie divisée par 2 |
| 3 | Ergonomie des postes | 4 000 € | 10 | Débloque substitution « aide au levage » ; postures E −1 |
| 3 | Prévention des RPS / QVCT | 3 500 € | 8 | Débloque les mesures RPS ; +3 d'envie sur le site |
| 3 | Relais sécurité | 2 000 € | 6 | Débloque la nomination de relais |
| 4 | Remontées spontanées | 3 000 € | 8 | Active la remontée spontanée (§ 4.5) |
| 4 | Démarche ISO 45001 | 8 000 € | 15 | Réussite automatique de l'audit client ; AT/MP −0,3 point |

### 4.11 Paliers de maîtrise de l'entreprise
Ils jouent le rôle des « âges » du genre. Pour passer au palier suivant, il faut remplir les conditions, **payer**,
puis attendre 15 jours de « mise en conformité ». Le panneau Paliers montre les conditions en liste à cocher, en
direct.

| Palier | Nom | Conditions pour y accéder | Coût | Débloque |
| --- | --- | --- | --- | --- |
| 1 | Réactif | (départ) | — | Formations, EPI, EPC simples, évaluation |
| 2 | Conforme | Toutes les UT évaluées depuis moins d'un an ; aucun risque connu ≥ 81 sans mesure engagée ; ≥ 80 % des extincteurs et trousses à jour | 8 000 € | EPC lourdes, organisation, recherches de palier 2 |
| 3 | Proactif | Aucun risque connu ≥ 51 ; ≥ 70 % des risques connus au niveau de maîtrise 2 ou plus ; ≥ 60 % des salariés formés à leur poste (hors accueil et SST) ; envie moyenne ≥ 60 ; ≥ 20 presqu'accidents analysés | 20 000 € | Substitution, relais sécurité, recherches de palier 3 |
| 4 | Culture de prévention | Aucun risque connu ≥ 48 ; envie moyenne ≥ 70 ; ≥ 2 relais sécurité ; aucun accident avec arrêt sur les 60 derniers jours | 25 000 € | Suppression ; **victoire** |

Au lot 1, le palier 3 est le dernier et vaut victoire ; le palier 4 (qui demande les relais) arrive au lot 2. Le
passage de palier se voit sur le site : drapeaux du rond-point, signalétique, et une courte animation de la barre du
haut.

### 4.12 Événements
Planifiés selon la graine, au moins un par mois. Un événement à choix met le jeu en pause et ouvre une fenêtre ; les
autres apparaissent dans le fil d'alertes.

| Événement | Quand | Effet |
| --- | --- | --- |
| Contrôle de l'inspection du travail | Une fois entre les mois 4 et 8, et après chaque accident grave | Vérifie : UT non évaluées ou évaluées depuis plus d'un an, risques ≥ 81 sans mesure. 0 écart : +2 d'envie. 1–2 écarts : observations à corriger sous 20 jours, sinon amende. 3 écarts ou plus : 5 000 € par écart (modèle simplifié). |
| Canicule | 10 jours en juillet ou août du calendrier de jeu | Envie −8 ; E +1 sur les familles `ambiances`, `charge_physique` et `rps`, sauf avec « Pauses et horaires d'été » |
| Commande urgente (choix) | Une fois, mois 3 à 10 | Accepter : production +30 % pendant 10 jours, exposition ×1,3, envie −5. Refuser : rien. |
| Nouvel embauché / intérimaire | 2 fois | Nouveau salarié non formé (sauf avec « Accueil sécurité ») |
| Machine neuve | 1 fois | Nouveau risque (famille selon l'archétype) sur une UT, à évaluer |
| Réunion du CSE (choix) | Tous les 3 mois | Une demande à satisfaire parmi trois (coût / envie / levier), par exemple « Salle de pause climatisée », « Formation gestes et postures », « Revoir les plannings » |
| Visite de la médecine du travail | 1 fois | Révèle les risques cachés TMS et RPS d'un bâtiment |
| Subvention prévention | 1 fois, fenêtre de 30 jours | 50 % des EPC achetées pendant la fenêtre sont remboursées, plafond 10 000 € (inspiré des aides de l'Assurance Maladie – Risques professionnels, montants fictifs) |
| Audit client | Mois 10 si palier ≥ 3 | Sans accident avec arrêt depuis 30 jours : marge +15 % pendant 2 mois |

Les textes peuvent reprendre les descriptions et commentaires réels des risques DigiRisk de l'UT concernée (champ
`description`, `latestEvaluation.comment`).

### 4.13 Victoire, défaite, score
- **Victoire** : palier 4 atteint. L'écran de fin propose de continuer jusqu'à la fin de l'année pour le score.
- **Fin de l'année** sans palier 4 : bilan et score ; « Année réussie » si le score est ≥ 400.
- **Défaites** : découvert prolongé (§ 4.4) ; crise sociale (§ 4.5) ; faute inexcusable (§ 4.7, mode normal).
- **Score sur 1 000**, calculé sur **tous** les risques, cachés compris (identifier est récompensé) :
  - palier : 100 × (palier − 1) → 300 ;
  - cotation résiduelle moyenne : 200 × clamp((60 − moyenne) / 40, 0, 1) ;
  - envie moyenne finale : 200 × clamp((envie − 30) / 50, 0, 1) ;
  - accidents : max(0, 200 − 40 × arrêts − 120 × graves − 30 × maladies) ;
  - trésorerie : 100 × clamp(trésorerie finale / (2 × `START_CASH`), 0, 1).
  Étoiles : ★ ≥ 400, ★★ ≥ 600, ★★★ ≥ 800.

### 4.14 Modes et difficulté
- **Modes** : « Démo » (snapshot, graine fixe, mode par défaut) ; « Mon DUER » (lot 2 : `loadDigiRiskData()` avec la
  clé et l'entité mémorisées par le jumeau, clé `digiriskgame.entity`) ; « Mon site » (lot 3 : scène JSON de l'éditeur).
- **Difficulté** : facile / normal / expert (annexe D) : trésorerie de départ, `INCIDENT_BASE`, fréquence des
  événements, faute inexcusable fatale ou non.

---

## 5. Interface et commandes

### Écrans
1. **Accueil** (`/aoe`) : titre, choix du mode et de la difficulté, « Reprendre » si une sauvegarde existe, courte
   explication des 4 jauges, mention « Modèle simplifié à visée pédagogique : ne remplace pas l'évaluation des
   risques de votre entreprise ».
2. **Partie**, plein écran :
   - **barre du haut** : trésorerie (et variation du mois), envie moyenne (jauge + tendance), risques (compteurs gris,
     orange, rouge, noir + « jours sans accident »), palier (1–4, anneau de progression), date, vitesse, menu ;
   - **fil d'alertes** à gauche : presqu'accidents (avec compte à rebours), accidents, événements, chantiers terminés.
     Un clic centre la caméra ;
   - **panneau de sélection** en bas au centre : fiche (salarié, préventeur, UT, bâtiment, chantier) et grille de
     commandes ;
   - **minicarte** en bas à droite : adaptée de `ExplorerMinimap` (UT colorées, salariés, alertes) ; cliquer déplace
     la caméra ;
   - **tiroir « Prévention »** à droite (touche P) : onglets Risques (tri par cotation, filtre par famille et par
     niveau de maîtrise), Plan d'actions, Recherches, Paliers, Équipe.
3. **Fenêtres** : événement à choix, bilan mensuel (recettes, dépenses, accidents, évolution des 4 jauges, conseil),
   fin de partie (score détaillé, causes, 3 conseils tirés de la partie).

### Commandes par sélection
- **Salarié(s)** : Produire (retour au poste) ; Former ▸ (formations pertinentes, avec coût et durée) ; Chantier
  (clic sur un chantier) ; Participer à l'évaluation ; Nommer relais (lot 2).
- **Préventeur** : Évaluer une UT ▸ (normale ou participative) ; Analyser (clic sur une alerte) ; Visite terrain (va
  dans l'UT : +4 d'envie pendant 20 jours) ; Causerie (lot 2).
- **UT** : risques avec critères, leviers actifs et niveau de maîtrise ; Équiper (EPI) ▸ ; Construire ▸ (EPC posables
  et aménagements) ; Organisation ▸ ; Substitution ▸ ; Évaluer (y envoie le préventeur).
- **Bâtiment** : risques communs, vérification des extincteurs et trousses (80 € par équipement), mesures de bâtiment.
- **Chantier** : avancement, équipe, passer au prestataire, annuler.

### Souris et clavier
- Clic gauche : sélectionner ; glisser : sélection par rectangle (salariés) ; Maj+clic : ajouter à la sélection.
- Clic droit : commande contextuelle (sur une UT → y produire ; sur un chantier → y travailler ; sur une alerte →
  l'analyser avec le préventeur).
- Caméra : OrbitControls avec déplacement latéral, angle polaire et zoom bornés ; ZQSD / WASD et flèches pour
  déplacer la vue.
- Raccourcis : Espace pause ; 1 / 2 / 3 vitesses ×1 / ×2 / ×4 ; H préventeur ; B construire ; P tiroir ; R pivoter la
  pose ; Échap annuler ; Suppr annuler le chantier ; F centrer la sélection.
- Écran tactile seul : message « Le jeu nécessite une souris et un clavier » (même détection que `EXPLORER_SUPPORTED`).

### Tutoriel (lot 1)
Panneau de mission dans l'esprit de la visite guidée existante, six étapes passables : (1) la carte et les couleurs ;
(2) sélectionner le préventeur et évaluer l'UT la plus à risque ; (3) analyser un premier presqu'accident (le premier
est forcé à la minute 1) ; (4) envoyer deux salariés en formation ; (5) poser une protection collective ; (6)
l'objectif « palier Conforme ».

### Retours visuels 3D
- Couleur et gyrophare des UT selon la cotation résiduelle du jeu, mis à jour en direct.
- Salariés : `Person` avec casque ou gilet visibles seulement si l'EPI est fourni **et** porté (`colors`) ; pastille
  d'envie ; anneau de sélection ; les absents sont retirés de la carte.
- Alertes : bulle « ! » au-dessus de l'UT avec anneau de compte à rebours ; accident : impulsion rouge.
- Chantier : fantôme translucide de l'élément + barre d'avancement ; évaluation en cours : icône de bloc-notes.
- Camions de livraison : actifs si la production est positive, vitesse proportionnelle à la production (0,5 à 1,5).
- Accessibilité : chaque niveau de cotation a aussi son libellé (Faible, Modéré, Élevé, Critique), jamais la couleur seule.

---

## 6. Architecture technique

### 6.1 Arborescence
```
src/game/                    moteur pur : aucun import de React, three, Vite, DOM ; exécutable sous Node
  config.js                  constantes d'équilibrage + difficultés (annexe D)
  rng.js                     générateur pseudo-aléatoire à graine (mulberry32), état sérialisable
  cotation.js                cotationFromCriteria, calibrage des critères, niveau de maîtrise
  riskFamilies.js            familles (regex), profils, modèles de risques cachés par archétype (annexe B)
  measures.js                catalogue des mesures (annexe C) et calcul des leviers
  actionPlan.js              tâches DigiRisk → actions jouables (§ 4.9)        [lot 2]
  research.js                arbre des recherches (§ 4.10)                     [lot 2]
  levels.js                  paliers : conditions, coûts (§ 4.11)
  events.js                  planification et résolution des événements (§ 4.12)
  createGame.js              état initial (hiérarchie DigiRisk + salariés + géométrie)
  step.js                    avance la simulation d'un pas
  commands.js                applyCommand : seule porte d'entrée des actions du joueur
  score.js                   score, victoire, défaite
src/services/walkRoute.js    plus court chemin sur le graphe piéton (extrait de WorkerAgents.jsx)
src/services/cotationScale.js getCotationScale + statsFromRisks (extraits, voir 6.7)
src/services/gameSave.js     sauvegarde localStorage
src/components/game/         interface et 3D, chargés à part
  GameApp.jsx  gameStore.js  GameCanvas.jsx  GameUnits.jsx  GameMarkers.jsx  PlacementGhost.jsx
  ResourceBar.jsx  AlertFeed.jsx  SelectionPanel.jsx  PreventionDrawer.jsx  GameMinimap.jsx
  EventModal.jsx  MonthlyReport.jsx  EndScreen.jsx  StartScreen.jsx  Tutorial.jsx
src/styles/game.css
scripts/simulate-game.mjs    équilibrage et vérifications sans navigateur (§ 8)
```
**Règles pour `src/game/`** : imports avec extension explicite `.js` (pour Node), pas d'`import.meta`, pas d'import de
JSON (les données sont passées en paramètre), pas d'horloge réelle ni de `Math.random` (tout passe par `rng.js`).
`archetypes.js` peut être importé (`../services/archetypes.js`) ; pas `digiriskApi.js` ni `siteLayout.js`, qui ne
fonctionnent pas sous Node.

### 6.2 Contrat du moteur
```js
createGame({ hierarchy, employees, geometry, scenario, difficulty, seed, startDate }) → state
// hierarchy : sortie de loadDigiRiskData (rootEntity, buildings…)
// geometry  : { utPositions: { [utId]: [x, z] }, buildingOf: { [utId]: gpId }, trainingSpot: [x, z], gate: [x, z] }
//             calculée côté interface depuis layoutTwin ; le script Node en fournit une approximative
step(state, dtDays) → events[]       // fait avancer `state` (mutation en place), renvoie les faits marquants pour l'interface
applyCommand(state, command) → { ok: true } | { ok: false, error: 'Trésorerie insuffisante' }
selectors : utView(state, utId), riskView(state, riskId), siteSummary(state), levelProgress(state), scoreOf(state)
```
- **Déterminisme** : même graine + même suite de commandes horodatées + mêmes pas → même état. Le script
  d'équilibrage le vérifie.
- **Budget de temps** : un `step` < 2 ms pour 30 salariés et 100 risques ; une année simulée sous Node < 1 s.

### 6.3 Forme de l'état (JSON pur : ni `Set`, ni `Map`, ni classe)
```js
{
  version: 1, seed, rng, difficulty, scenario, startDate,
  clock: { day, speed, paused },                        // day : jours ouvrés écoulés (décimal)
  cash, atmpRate, ledger: [{ month, income, costs: { fixed, atmp, upkeep, measures, accidents, other } }],
  level: { current, upgrading: null | { to, endsAt } },
  buildings: { [gpId]: { id, ref, label, risksIds } },
  workUnits: { [utId]: { id, ref, label, buildingId, archetype, marginFactor, evaluatedAt, evaluation: null | { endsAt, participative }, epiAutoRenew } },
  risks: { [riskId]: { id, scope: { type: 'ut'|'building'|'site', id }, ref, categoryName, family, source: 'digirisk'|'latent'|'event',
                       known, criteriaBase, criteria, cotationSource, cotationBase, cotation, mastery, doneTasks: [] } },
  employees: { [id]: { id, name, job, homeUtId, role: 'staff'|'preventer'|'relay', state, task, pos, travel: null | { from, to, start, end },
                       envie, trainings: { [trainingId]: dayObtained }, epi: { [epiId]: dayIssued }, absentUntil, lowEnvieDays, chronic: { [riskId]: dose } } },
  measures: { [id]: { id, kind, scope, status: 'building'|'active'|'expired', workDone, workNeeded, crew: [], contractor, pos, rotation, activeSince } },
  research: { done: [], current: null | { id, endsAt } },
  incidents: [{ id, riskId, outcome, day, expiresAt, handled }],
  events: { scheduled: [], active: [], pendingChoice: null, log: [] },
  stats: { nearMissHandled, nearMissExpired, accidents: { minor, lostTime, serious }, diseases, monthly: [] },
  revision: { risks: 0, employees: 0, measures: 0 },     // incrémentés à chaque changement : l'interface ne recalcule qu'à ce moment
  outcome: null | { result: 'victory'|'defeat'|'yearEnd', reason, score, details }
}
```

### 6.4 Commandes (liste fermée)
`assignProduction`, `sendTraining`, `evaluateUt`, `analyseIncident`, `fieldVisit`, `placeMeasure`, `assignCrew`,
`switchToContractor`, `cancelMeasure`, `buyEpi`, `setEpiAutoRenew`, `toggleOrganisation`, `startResearch`,
`startLevelUp`, `completeTask`, `resolveEventChoice`, `recruit`, `designateRelay`, `holdTalk` (causerie).
Chaque commande vérifie palier, recherche, trésorerie et état des unités, et renvoie un message d'erreur en français.
La vitesse et la pause sont gérées par le store de l'interface, pas par le moteur.

### 6.5 Intégration 3D
- `GameApp` charge les données (`loadDigiRiskData`), calcule `layoutTwin(hierarchy, loadSkins())`, en dérive la
  `geometry`, crée la partie et lance la boucle (`requestAnimationFrame` hors Canvas, ou `useFrame`) avec le pas fixe.
- **Couleurs du site** : à chaque `revision.risks`, construire une copie des données de rendu où chaque UT, chaque
  groupement et chaque zone de sous-groupement reçoivent `stats = statsFromRisks(risquesDuJeu)` ; chaque risque du jeu
  expose `cotationBrute` (base) et `cotationResiduelle` (courante). `WorkUnitZone`, `BuildingGroup` (bâtiments et
  zones) et `HierarchyNavigator` ne lisent que `stats.scale*` / `stats.max*` / `stats.totalRisks` : ils fonctionnent
  alors sans modification. Ne pas recalculer à chaque image.
- **Extincteurs et trousses** (lot 2) : le jeu tient l'état de vérification **par UT** (un extincteur et une trousse
  par UT). Statut initial = ``equipmentCheck(kind, `${utId}:${kind}:0`)``. En mode jeu, l'infobulle 3D d'un
  équipement (clé `${owner.id}:${kind}:${slot}`) affiche l'état de jeu de l'UT propriétaire, pas la date de démonstration.
- `GameCanvas` reprend la composition de `DigitalTwinCanvas` (site, décor, ciel, camions) avec sa propre caméra RTS
  et sans la visite. Ne pas modifier le comportement de `DigitalTwinCanvas`.
- `GameUnits` : un `Person` par salarié présent, position interpolée sur la courbe `walkRoute` + `buildRoundedIndustrialCurve`
  entre `travel.start` et `travel.end`. Au-delà de 20 unités visibles, simplifier (pas de `Html` par unité : pastilles
  en sprites ou en instances).
- Mesures posées : `ElementModel` de l'éditeur à la position et la rotation de la mesure.
- Pose : plan au sol, aimantation de 0,25 unité (reprendre `snapValue` de `editorScene.js`), validité selon
  l'emprise de l'UT (`ut.layout3D`).
- Cibles : 60 images/s sur un portable récent avec 30 salariés ; pas de régression de performance sur `/` et `/edit`.

### 6.6 Sauvegarde
`src/services/gameSave.js` : clé `digiriskgame.game.v1`, sauvegarde automatique en fin de mois et au menu, un seul
emplacement. On enregistre l'état et la source (`{ mode, entity }`), pas la hiérarchie. À la reprise, on recharge la
source ; si des identifiants de risques ou d'UT ont disparu, on prévient et on propose une nouvelle partie. Toujours
dans un `try/catch` : sans stockage, le jeu fonctionne sans reprise.

### 6.7 Remaniements préalables (lot 0, sans changement de comportement)
1. Extraire `walkRoute` (et son tas binaire) de `WorkerAgents.jsx` vers `src/services/walkRoute.js` ;
   `WorkerAgents.jsx` l'importe.
2. Extraire `getCotationScale` et `statsFromRisks` de `digiriskApi.js` vers `src/services/cotationScale.js` (sans
   import) ; `digiriskApi.js` les réexporte, pour que les imports existants restent valides.
3. Routage : `/aoe` et `?aoe` dans `src/main.jsx` (chargé avec `lazy()`, comme l'éditeur), règles `aoe` dans
   `.htaccess` (copie des règles `edit`), bouton « Jouer » (icône `Gamepad2`) dans `TopHudBar.jsx`, à côté
   d'« Éditeur ».

---

## 7. Lots, livrables, critères d'acceptation

Commun à tous les lots : `npm run build` sans erreur, aucune erreur dans la console sur `/`, `/edit` et `/aoe`, le
jumeau et l'éditeur se comportent comme avant, section README « Jeu de gestion (`/aoe`) » à jour, `dist/` reconstruit,
`node scripts/simulate-game.mjs --check` vert.

### Lot 0 — Fondations
- Remaniements du § 6.7.
- `src/game/` : `config`, `rng`, `cotation`, `riskFamilies`, `createGame` (snapshot + équipe générée), `step`
  (horloge, production, trésorerie, fin de mois), `commands` (`assignProduction`).
- Écran d'accueil minimal et partie « Démo » : site affiché, barre du haut qui tourne, pause et vitesses.
- `scripts/simulate-game.mjs` : stratégie « rien », trésorerie mois par mois.
- **Acceptation** : les 11 points de l'annexe A sont retrouvés exactement ; chaque risque du snapshot a des critères
  calibrés dont la cotation est dans le même niveau d'échelle que la cotation DigiRisk ; à ×1 un mois dure
  200 s ± 2 s ; même graine → même trésorerie après 12 mois simulés.

### Lot 1 — Jeu jouable (MVP)
- Salariés : sélection (clic, rectangle), déplacement, production, formation, chantier, absences, démissions.
- Préventeur : évaluation (normale et participative), analyse des presqu'accidents, visite terrain.
- Risques cachés et révélation ; incidents et accidents (aigus) ; faute inexcusable.
- Envie : modèle complet du § 4.5 (hors remontée spontanée) et ses effets.
- Mesures : formations (accueil, gestes et postures, CACES, travail en hauteur, risque chimique, équipier incendie,
  SST), EPI (chaussures, gants, casque, gilet, antibruit, masque, harnais, lunettes), EPC posables (garde-corps, zone
  balisée, potelets, extincteur, trousse, douche, panneaux, éclairage, transpalette), en interne ou par prestataire.
- Paliers 1 → 2 → 3 (au lot 1, le palier 3 vaut victoire, § 4.11), bilan mensuel, fin de partie, score, sauvegarde,
  tutoriel, raccourcis.
- **Acceptation** :
  - une partie « Démo » se joue jusqu'au bout sans blocage : victoire (palier 3), fin des 12 mois ou défaite ;
  - former 100 % des salariés d'une UT (accueil + formation spécifique de la famille) fait passer le F d'un risque de
    4 à 1 et met à jour la couleur de l'UT en moins d'une seconde ;
  - un EPI fourni à une UT dont l'envie moyenne est 20 n'a aucun effet sur la cotation ; à 70 et plus, effet complet ;
  - un presqu'accident non traité disparaît après 3 jours de jeu et retire 1 point d'envie à l'UT ;
  - un accident grave sur un risque connu ≥ 51 sans mesure engagée met fin à la partie en normal, avec l'explication ;
  - recharger la page après une sauvegarde reprend la partie au même jour, avec la même trésorerie.

### Lot 2 — Profondeur
- Recherches, palier 4 complet, organisation, substitution, suppression, relais sécurité, remontées spontanées.
- Plan d'actions DigiRisk (§ 4.9), maladies professionnelles, vérification des extincteurs et trousses (statuts
  initiaux tirés de `equipmentChecks.js`, et un équipement en retard ajoute +1 au P des risques incendie de son UT),
  cotisation AT/MP, tous les événements du § 4.12, difficulté, mode « Mon DUER ».
- **Acceptation** : les objectifs d'équilibrage du § 8 sont atteints ; en mode « Mon DUER » sur l'instance de
  démonstration, la partie démarre avec les vrais salariés (si le droit de lecture est donné) et les tâches en cours
  apparaissent dans « Plan d'actions » avec leur coût restant.

### Lot 3 — Extensions
- Mode « Mon site » : scène JSON de l'éditeur (`digiriskgame-site` v1). Chaque élément `station:<archétype>` devient
  une UT avec les risques types de son archétype (critères par défaut de l'annexe B), et les éléments de sécurité
  posés comptent comme des mesures déjà actives.
- Évaluation à pied : depuis une UT, passer en visite 1re personne ; inspecter l'UT (touche E) l'évalue avec 100 % de
  révélation et +4 d'envie.
- Export du plan d'actions joué (JSON et CSV : UT, risque, mesure, coût, date de jeu), à reprendre dans DigiRisk.
- Défi : partie à graine imposée par l'URL (`/aoe?graine=1234`), score affiché pour comparaison.

---

## 8. Équilibrage et vérification

`scripts/simulate-game.mjs` lit le snapshot avec `fs` (pas d'import JSON), construit une géométrie approximative (UT
réparties sur une grille selon l'ordre de l'arborescence) et joue sans interface avec des stratégies automatiques qui
passent **uniquement par `applyCommand`** :

| Stratégie | Comportement | Objectif (50 graines, difficulté normale) |
| --- | --- | --- |
| `rien` | Production seulement | Défaite ≥ 50 % ; échec (défaite ou année sans étoile) ≥ 90 % ; jamais de victoire |
| `epi` | Achète et renouvelle tous les EPI, rien d'autre | Score moyen < 450 ; envie finale moyenne < 50 |
| `formation` | Forme tout le monde, rien d'autre | Score moyen < 550 |
| `depensier` | Fait poser toutes les EPC par prestataire dès le départ | Défaite par trésorerie ≥ 50 % ou score moyen < 500 |
| `equilibre` | Évalue par cotation décroissante, traite chaque risque ≥ 51 avec la mesure la plus haute disponible dans la hiérarchie en gardant 3 000 € de réserve, analyse les presqu'accidents, passe les paliers dès que possible | Palier de victoire (3 en V1, 4 ensuite) atteint avant le mois 12 dans ≥ 60 % des parties ; défaite ≤ 10 % ; score moyen ≥ 650 |

- Sortie : un tableau par stratégie (victoires, défaites par cause, score moyen, accidents, trésorerie finale, envie
  finale, palier atteint).
- `--check` : vérifie aussi l'annexe A, le calibrage, le déterminisme (deux exécutions identiques) et la durée (< 1 s
  par année simulée). Le code de sortie est 1 si un objectif n'est pas atteint.
- On règle d'abord les valeurs de `config.js`, puis seulement les formules. Chaque réglage notable est justifié en une
  ligne dans la PR.

---

## 9. Contraintes et hors périmètre

- **Hors périmètre** : écriture dans Dolibarr, multijoueur, écran tactile, langues autres que le français, sons
  (possible plus tard), calcul réel du taux AT/MP ou des sanctions.
- **Données personnelles** : on n'utilise des salariés que les champs déjà lus (prénom, nom, poste). Ils ne quittent pas
  le navigateur (sauvegarde locale), et l'export du plan d'actions ne contient pas de nom.
- **Exactitude** : les mécanismes juridiques et financiers sont simplifiés et présentés comme tels (mention à l'accueil
  et dans les fenêtres concernées). Le vocabulaire DigiRisk (UT, GP, cotation, brute / résiduelle) est respecté.
- **Ton** : pas de moquerie envers les victimes, pas de représentation de blessure. Les accidents se traduisent par un
  marqueur, une absence et un message factuel.

---

## 10. Points ouverts (valeur par défaut retenue en attendant l'arbitrage de l'équipe)

| Question | Défaut retenu |
| --- | --- |
| Public prioritaire : clients DigiRisk, formation interne ou grand public ? | Clients et salariés en sensibilisation |
| Jouer sur son propre DUER dès le MVP ? | Non : démo au lot 1, « Mon DUER » au lot 2 |
| La faute inexcusable doit-elle faire perdre ? | Oui en normal, amende en facile |
| Durée d'une partie | 12 mois ≈ 40 min à ×1 |
| Titre du jeu | « Objectif Prévention » (provisoire) |
| Renvoyer les actions jouées vers DigiRisk ? | Export fichier seulement (lot 3), pas d'écriture API |

---

## 11. Glossaire

- **DUER / DUERP** : document unique d'évaluation des risques professionnels, géré dans DigiRisk.
- **GP / UT** : groupement (ici un bâtiment ou une zone) / unité de travail (un poste ou un atelier).
- **Cotation** : note de risque DigiRisk 0–100. **Brute** : sans les mesures du joueur. **Résiduelle** : avec.
- **G, E, O, F, P** : Gravité, Exposition, Occurrence, Formation, Protection (méthode avancée DigiRisk).
- **EPI / EPC** : équipement de protection individuelle / collective.
- **Principes généraux de prévention** : hiérarchie des mesures (supprimer, substituer, protéger collectivement, puis
  individuellement, former et informer), article L4121-2 du Code du travail.
- **AT/MP** : accidents du travail / maladies professionnelles ; la cotisation dépend de la sinistralité.
- **CACES, SST** : certificat de conduite d'engins (chariot) ; sauveteur secouriste du travail.
- **CSE** : comité social et économique.
- **Presqu'accident** : événement sans dommage qui aurait pu en causer un ; signal à analyser.

---

## Annexe A — Équivalence produit G×E×O×F×P → cotation

Points mesurés dans le snapshot (méthode avancée, cohérents entre plusieurs évaluations) ; interpolation linéaire
entre deux points, bornes ajoutées en 0 et 1 024.

| Produit | 0 | 24 | 27 | 32 | 48 | 64 | 72 | 96 | 128 | 144 | 192 | 384 | 1024 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cotation | 0 | 17 | 20 | 25 | 31 | 40 | 42 | 46 | 50 | 55 | 66 | 90 | 100 |

Exemples mesurés : (4,4,2,4,3) → 90 ; (4,4,2,2,3) → 66 ; (4,3,1,4,4) → 66 ; (3,4,1,3,4) → 55 ; (4,4,1,2,4) → 50 ;
(2,4,1,3,4) → 46 ; (3,4,1,2,3) → 42 ; (4,2,1,2,4) → 40 ; (3,4,1,2,2) → 31 ; (4,1,1,2,4) → 25 ; (3,1,1,3,3) → 20 ;
(3,4,1,2,1) → 17. Les 0 et 1 024 sont des bornes ajoutées (1 024 = 4⁵) ; la borne haute est à confirmer avec la
matrice officielle.

## Annexe B — Familles de risques et risques cachés

Correspondance par regex sur le libellé normalisé de la catégorie (première règle qui correspond). Profil = critères
par défaut G, E, O, F, P (sert au calibrage et aux risques cachés). « Aigu » : accidents ; « chronique » : maladies
(§ 4.7).

| Famille | Regex (libellé de catégorie) | Profil G,E,O,F,P | Nature | Mesures typiques |
| --- | --- | --- | --- | --- |
| `chute_plain_pied` | `plain-pied` | 2,4,1,3,3 | aigu | chaussures, éclairage, zone balisée, rangement |
| `chute_hauteur` | `hauteur` | 4,3,1,3,3 | aigu | garde-corps, harnais, travail en hauteur, nacelle |
| `circulation` | `circulations? internes\|engins` | 4,4,1,3,3 | aigu | allées, zones, potelets, CACES, gilet, plan de circulation |
| `routier` | `routier` | 4,4,1,3,3 | aigu | prévention routière, réunions à distance, télétravail |
| `charge_physique` | `charge physique\|manutention` | 3,4,1,3,3 | chronique | gestes et postures, transpalette, rotation, aide au levage |
| `postures` | `postures` | 2,4,1,3,3 | chronique | ergonomie, rotation, gestes et postures |
| `chimique` | `chimique\|emissions\|dechets` | 3,4,1,3,3 | chronique | gants, masque, lunettes, douche, aspiration, substitution |
| `biologique` | `biologique` | 2,3,1,3,3 | aigu | gants, hygiène (information) |
| `chute_objets` | `effondrement\|chutes? d.objets` | 3,3,1,3,3 | aigu | casque, chaussures, rangement |
| `incendie` | `incendie\|explosion` | 4,3,1,3,3 | aigu | extincteur à jour, équipier incendie, permis feu |
| `electricite` | `electricit` | 4,2,1,4,3 | aigu | habilitation électrique, vérifications |
| `bruit` | `bruit\|sonore` | 2,4,1,3,3 | chronique | antibruit, capotage, rotation |
| `ambiances` | `ambiance\|lumineuse\|thermique` | 1,4,1,3,3 | aigu | éclairage, pauses chaleur |
| `rps` | `psychosoc` | 3,4,1,3,3 | chronique | prévention des RPS, télétravail, plannings, CSE |
| `machines` | `machine\|outil\|mecanique` | 3,4,1,3,3 | aigu | protecteurs, gants, lunettes, automatisation |
| `general` | (par défaut) | 2,3,1,3,3 | aigu | formation accueil, information |

**Risques cachés par archétype de poste** (seulement si la famille n'existe pas déjà dans l'UT) :

| Archétype | Familles cachées |
| --- | --- |
| `welding` | incendie, chimique (fumées), bruit |
| `machining`, `drill_press`, `shear`, `saw_cutting`, `workshop` | machines, bruit, charge_physique |
| `forklift` | circulation, chute_objets |
| `paint_booth`, `curing_oven` | chimique, incendie |
| `hanging_line` | postures, charge_physique |
| `wastewater`, `unloading`, `chemical_storage` | chimique, chute_plain_pied |
| `warehouse_storage`, `air_freight`, `sea_freight` | circulation, charge_physique, chute_objets |
| `courier`, `road_sales` | routier |
| `trade_show` | routier, charge_physique |
| `it_support` | electricite, postures |
| `admin_office`, `sales_office`, `design_office`, `meeting_room` | postures, rps |

## Annexe C — Catalogue initial des mesures (valeurs initiales)

Formations (périmètre : salarié ; effet dans son UT ; force = réduction de F maximale quand toute l'UT est formée) :

| Id | Libellé | Familles | Force F | Durée | Coût / pers. | Palier |
| --- | --- | --- | --- | --- | --- | --- |
| `form_accueil` | Accueil sécurité au poste | toutes celles de l'UT | 1 | 0,5 j | 150 € | 1 |
| `form_gestes` | Gestes et postures | charge_physique, postures | 2 | 2 j | 400 € | 1 |
| `form_caces` | CACES chariot | circulation | 2 | 3 j | 900 € | 1 |
| `form_hauteur` | Travail en hauteur | chute_hauteur | 2 | 1 j | 350 € | 1 |
| `form_chimique` | Risque chimique | chimique | 2 | 1 j | 350 € | 1 |
| `form_incendie` | Équipier de première intervention | incendie | 2 | 1 j | 250 € | 1 |
| `form_sst` | Sauveteur secouriste du travail | (suites d'accident −30 % dans le bâtiment) | — | 2 j | 500 € | 1 |
| `form_elec` | Habilitation électrique | electricite | 2 | 2 j | 600 € | 2 |
| `form_route` | Prévention du risque routier | routier | 2 | 1 j | 300 € | 2 |
| `form_rps` | Prévention des RPS (managers) | rps | 2 | 1 j | 450 € | 3 |

EPI (périmètre : UT ; coût par salarié de l'UT ; renouvellement tous les 120 jours ; effet × port) :

| Id | Libellé | Familles | Levier P | Coût / pers. |
| --- | --- | --- | --- | --- |
| `epi_chaussures` | Chaussures de sécurité | chute_plain_pied, chute_objets | −1 | 60 € |
| `epi_gants` | Gants adaptés | chimique, machines, biologique | −1 | 25 € |
| `epi_casque` | Casque | chute_objets | −1 | 40 € |
| `epi_gilet` | Gilet haute visibilité | circulation, routier | −1 | 15 € |
| `epi_antibruit` | Protection auditive | bruit | −1,5 | 30 € |
| `epi_lunettes` | Lunettes de protection | chimique, machines | −1 | 20 € |
| `epi_masque` | Masque respiratoire | chimique | −1,5 | 45 € |
| `epi_harnais` | Harnais antichute | chute_hauteur | −1,5 | 180 € |

Protections collectives posables (élément `ELEMENT_KINDS` de l'éditeur ; travail en jours-hommes) :

| Id (élément) | Libellé | Familles : leviers | Coût | Travail | Entretien / mois | Palier |
| --- | --- | --- | --- | --- | --- | --- |
| `guardrail` | Garde-corps | chute_hauteur : O −1, P −1 | 150 € / m | 0,5 j / 3 m | 5 € | 2 |
| `floorzone` | Zone balisée au sol | circulation : O −0,5 ; chute_plain_pied : O −0,5 | 200 € | 0,5 j | 0 € | 1 |
| `bollard` | Potelet | circulation : O −0,3 (cumul ≤ 3) | 120 € | 0,25 j | 0 € | 1 |
| `extinguisher` | Extincteur | incendie : P −1 (1 par UT, vérification à jour) | 150 € | 0,1 j | 7 € | 1 |
| `firstaid` | Trousse de secours | (suites d'accident −15 % dans l'UT) | 60 € | 0,1 j | 3 € | 1 |
| `shower` | Douche de sécurité | chimique : G −1 | 1 800 € | 2 j | 15 € | 2 |
| `sign_warning` | Panneau danger | toutes : F −0,3 (1 par UT) | 50 € | 0,1 j | 0 € | 1 |
| `sign_mandatory` | Panneau obligation (EPI) | port des EPI de l'UT +0,1 | 50 € | 0,1 j | 0 € | 1 |
| `sign_fire` | Panneau incendie | incendie : F −0,3 | 50 € | 0,1 j | 0 € | 1 |
| `lamp` | Éclairage | chute_plain_pied : O −0,5 ; ambiances : O −1 | 700 € | 1 j | 10 € | 1 |
| `palletjack` | Transpalette (aide à la manutention) | charge_physique : E −1 | 1 200 € | 0 j | 10 € | 2 |
| allée piétonne (`walkways`) | Allée piétonne marquée | circulation : O −1 | 40 € / m | 0,5 j / 10 m | 0 € | 2 |

Aménagements d'UT (non posables, périmètre UT) : `epc_aspiration` Aspiration / ventilation (chimique O −1, P −1 ;
6 000 € ; 4 j ; 50 € / mois ; palier 2) ; `epc_capotage` Capotage acoustique (bruit O −1, E −1 ; 4 000 € ; 3 j ;
palier 2) ; `epc_protecteurs` Protecteurs de machines (machines O −1, P −1 ; 2 500 € ; 2 j ; palier 2).

Organisation (bascule par UT, effet tant qu'elle est active) : `org_rotation` Rotation des postes (charge_physique,
postures, bruit E −1 ; production −5 % ; envie −3 pendant 20 jours puis +2 ; palier 2) ; `org_teletravail` Télétravail
partiel (UT de bureaux : routier E −1, rps O −1 ; envie +4 ; palier 2) ; `org_visio` Réunions à distance (routier
E −1 ; production −5 % ; palier 2) ; `org_ete` Pauses et horaires d'été (annule la canicule ; production −10 % pendant
la canicule ; palier 1) ; `org_plannings` Revoir les plannings (rps E −1 ; production −3 % ; palier 3).

Substitution (palier 3, recherche requise le cas échéant) : `sub_produit` Produit moins dangereux (chimique G −1 ;
8 000 €) ; `sub_levage` Aide au levage (charge_physique G −1 ; 10 000 € ; « Ergonomie des postes ») ; `sub_nacelle`
Nacelle au lieu d'échelle (chute_hauteur G −1 ; 9 000 €).

Suppression (palier 4) : `sup_automatisation` Automatiser la tâche (supprime un risque machines, charge_physique ou
chimique au choix ; 25 000 € ; 10 jours-hommes ; production de l'UT +10 %) ; `sup_flux` Séparer les flux piétons /
engins (supprime le risque de circulation du bâtiment ; 15 000 €).

## Annexe D — Valeurs initiales de `config.js`

| Constante | Facile | Normal | Expert |
| --- | --- | --- | --- |
| `START_CASH` | 25 000 € | 15 000 € | 8 000 € |
| `INCIDENT_BASE` (par jour, par exposé, à cotation 100) | 0,012 | 0,02 | 0,028 |
| Événements supplémentaires aléatoires par an | 2 | 4 | 6 |
| Faute inexcusable | amende 25 000 € | défaite | défaite |

Communes : `DAY_SECONDS` 10 ; `DAYS_PER_MONTH` 20 ; `MONTHS` 12 ; `SIM_STEP_DAYS` 0,05 ; `MAX_EMPLOYEES` 30 ;
`WALK_UNITS_PER_SECOND` 4 ; `MARGIN_PER_DAY` 160 € ; facteurs de marge par archétype de bâtiment : production 1,2,
peinture 1,1, logistique 1,0, bureaux 0,9, zone extérieure 1,0 ; `FIXED_COST_PER_EMPLOYEE_MONTH` 1 900 € ;
`PAYROLL_PER_EMPLOYEE_MONTH` 2 600 € ; `ATMP_RATE_START` 2,2 % ; `DECOUVERT_AUTORISE` 10 000 € ; `NEAR_MISS_TTL` 3
jours ; `CHRONIC_THRESHOLD` 60 ; `TRAINING_VALIDITY_DAYS` 160 ; `EPI_VALIDITY_DAYS` 120 ; recrutement 3 000 € (arrivée
sous 10 jours) ; passage de palier 8 000 / 20 000 / 25 000 € et 15 jours.
