# Direction artistique — « Maquette vivante »

Proposition de direction artistique pour l'éditeur de site et la mairie de démonstration (salon des maires).
Objectif : passer d'un rendu « jouet » (blocs, couleurs primaires, personnages sans visage, scène figée) à
une **maquette d'architecte habitée** : sobre et crédible pour un public de professionnels (élus, DGS,
préventeurs), mais vivante dès le premier regard.

## 1. Intentions

| Avant | Après |
| --- | --- |
| Formes en blocs, arêtes vives, membres carrés | Volumes arrondis et effilés, transitions lisses |
| Couleurs saturées (bleu vif, jaune, rouge primaire) | Palette naturelle et désaturée, un seul accent fort : les couleurs de cotation DigiRisk |
| Éclairage plat, objets « posés » sans contact | Lumière naturelle chaude, ombres de contact (occlusion ambiante), halo des sources lumineuses |
| Personnages sans visage, raides | Visages lisibles, coiffures variées, démarche naturelle, clignements, regard |
| Scène figée | Ville qui respire : drapeaux, fontaine, horloge à l'heure, arbres au vent, pigeons, habitants |

Principe directeur : **la sobriété crédible plutôt que le détail**. Peu de polygones, mais des proportions
justes, des couleurs vraies et du mouvement discret. Les seules couleurs franches de la scène sont celles qui
portent l'information DigiRisk (zones et pastilles de cotation, gilets haute visibilité).

## 2. Palette

- **Pierre et bâti** : pierre de taille `#efe7d6`, pierre ombrée `#d8ccb4`, ardoise `#4b5563`, zinc `#94a3b8`.
- **Bois et mobilier ancien** : noyer, chêne, cuir vert du sous-main, dorures discrètes `#c9a227`.
- **Végétation** : verts naturels `#4c7438` `#5a8443` `#43692f` `#66904c`, conifères `#2f5136`, écorce `#5b4a3c`.
- **Vêtements** : chemise claire `#d9e2ec`, anthracite `#3b4150`, marine `#36455c`, pantalons `#2e3440`.
- **EPI** : jaune haute visibilité `#d6de3a`, orange `#e8772e`, casque blanc `#f2f2f2`.
- **Véhicules** : gris, argent, blanc, noir, bleu nuit, bordeaux (plus de couleurs primaires).
- **Eau** : bleu-gris sombre et réfléchissant `#4f7486` (fini le bleu lumineux de dessin animé).
- **Information DigiRisk (seul accent saturé)** : cotation faible `#94a3b8`, modérée `#f97316`, élevée `#ef4444`,
  critique `#111827` ; marque DigiRisk marine `#1d3557` et orange `#e8772e` sur les écrans.

## 3. Lumière et rendu

- **Soleil légèrement doré** (`#fff2df`), ciel clair, **rebond chaud du sol** (ocre `#6e5c45` au lieu de vert),
  ambiance un peu baissée pour laisser travailler les ombres.
- **Rendu réaliste** (bouton à diaphragme de la barre d'outils, actif par défaut sur ordinateur, coupé sur
  écran tactile) :
  - **occlusion ambiante GTAO** à l'échelle d'une pièce : coins, dessous des meubles, pieds des personnages,
    jonctions mur / sol s'assombrissent — c'est ce qui supprime l'aspect « plat » ;
  - **halo léger** des seules sources très lumineuses (lustres, lanternes, écrans) ;
  - anticrénelage conservé (rendu multi-échantillonné), tonemapping filmique.
- Vitrages clairs et translucides, façades percées : la lumière et le regard traversent les fenêtres.
- **Avant-corps sans surface morte** : portail d'honneur (encadrement à bossages, clé de voûte, imposte
  vitrée en éventail, vantaux ouverts), fenêtres de part et d'autre au rez-de-chaussée, balcon d'honneur en
  fer forgé sur consoles, inscription « MAIRIE » à l'attique entre deux médaillons à couronne de laurier.

## 4. Personnages

- **Proportions réelles** (≈ 1,75 m, tête de 23 cm), squelette inchangé pour rester assis à leur place sur tous les postes.
- **Corps modelé** : torse construit section par section (large et plat aux épaules, taille marquée, pente douce
  vers le cou ; le haut des bras y est noyé comme une couture de manche), bras et jambes aux profils musclés,
  chaussures galbées.
- **Mains** : paume arrondie, quatre doigts de longueurs différentes en deux phalanges, légèrement repliés, et
  pouce opposable ; paumes tournées vers le bas au clavier, au poste et en portant.
- **Surfaces vivantes, rien de lisse** : chaque vêtement a sa texture — trame (toile, sergé, grosse toile de
  travail), plis, coutures, boutons, poches, revers, chemise et cravate peintes dans l'encolure, poignets qui
  dépassent des manches, pli du pantalon, ourlet, bandes réfléchissantes. Pas de pièce plaquée sur le corps.
- **Tête sculptée et visage peint** : crâne modelé (mâchoire qui s'affine vers un menton marqué, arcade
  sourcilière, pommettes, nuque) ; nez en relief (arête, bout, ailes, narines) et oreilles creusées (pavillon,
  conque, lobe) ; cheveux en volume (calotte épaisse dont la lisière suit exactement la coupe peinte, longueurs,
  chignon, queue de cheval) aux mèches fines. Visage peint en haute définition : iris strié et cerclé, coin
  de l'œil, pli de la paupière, sourcils poil à poil, sillons du nez à la bouche, creux au-dessus de la lèvre,
  reflet des lèvres, grain de peau, orbites, barbe naissante. **Regard détendu** : yeux en amande dont la
  paupière supérieure couvre le haut de l'iris, blanc de l'œil cassé et ombré (jamais d'yeux ronds
  écarquillés), coins de la bouche légèrement relevés.
- **Huit apparences** : quatre carnations, coupes courte / carré / longue / chignon / queue de cheval, cheveux
  gris, barbe, lunettes ; vêtements de ville de couleurs différentes d'une personne à l'autre ; apparences
  accordées aux prénoms dans la mairie.
- **Tenues métier** : chemise, costume, **maire avec l'écharpe tricolore** (épaule droite → hanche gauche, bleu
  côté col, nœud doré), veste de travail et gilet haute visibilité, **jardinier** (veste verte, casquette, gants ;
  il pousse une brouette quand il porte une charge), cariste, logisticien, soudeur, peintre.

## 5. Animation : vivant mais discret

Règles : **amplitudes faibles, rythmes lents, chacun son tempo** (aucun mouvement synchronisé), jamais de geste
brusque ; on doit sentir la vie sans voir des pantins.

- **Personnages** : respiration, regard qui se pose d'un interlocuteur à l'autre, hochements, appui d'une
  jambe sur l'autre, **clignement des yeux** toutes les 3 à 5 s ; au clavier les mains tapotent par périodes,
  au poste la main droite manipule, la gauche maintient, tête penchée sur l'ouvrage.
- **Actions ponctuelles** (une toutes les 12 à 20 s, de 4 à 7 s, entrée et sortie en douceur) : consulter
  son téléphone, boire un café (tasse portée aux lèvres), se tourner vers un collègue pour lui parler,
  prendre des notes, accompagner ses mots d'un geste mesuré de l'avant-bras, regarder sa montre, acquiescer,
  se redresser au poste. Assis, les mains reposent sur les cuisses ou la table.
- **Marche** : balancement des bras avec flexion du coude, **genou qui plie** pendant le passage de la jambe,
  petit rebond, regard qui se promène ; arrêt de quelques secondes au bout des trajets (guichet, collègue).
- **Une mairie habitée** : administrés qui attendent dans le hall, pause café, photocopies, archiviste qui
  porte ses cartons, rendez-vous dans le bureau de la maire, conseillers qui préparent le conseil, directrice
  des services dans la galerie, promeneuse et voisins qui bavardent sur la place.
- **Ville** : drapeaux qui flottent (ondulation croissante depuis le mât), rideau d'eau de la fontaine qui
  coule, **horloge du campanile à l'heure réelle**, houppiers des arbres qui se balancent au vent, pigeons qui
  marchent et picorent.

## 6. Décor et mobilier

- **Arbres d'alignement** : tilleuls au houppier en grappes irrégulières (chaque arbre différent), conifères
  étagés ; fin des boules facettées.
- **Postes de travail** : bâtiment d'époque, équipement d'aujourd'hui — écrans plats à cadre fin affichant
  de **vraies captures de DigiRisk** (12 vues : liste des risques, accidents, plan d'action, affichage légal,
  organigramme, tableau de bord, document unique, évaluateurs, signalisation, tickets, fiche d'unité de
  travail), différentes d'un poste à l'autre ; claviers, photocopieurs.
- **Papiers écrits** sur les bureaux, le guichet et la table du conseil : arrêté municipal, délibération,
  acte de naissance, permis de construire, tableau du document unique, plan d'action, courrier, budget —
  en-tête, titre, paragraphes, signature ; stylo posé à côté.
- **Jardinières** : bac de pierre à panneaux et couronnement mouluré ; buis taillés, touffes de lavande,
  géraniums en ombelles en bordure, graminées aux angles, lierre qui retombe par-dessus le rebord ; bouquet
  propre à chaque bac. Placées hors des passages (perron, allées du jardin).
- **Objets de marque** : jeu de cartes DigiRisk sur le bureau de la maire, présenté sur un présentoir imprimé
  « DigiRisk — Jeu de cartes » (boîte, cartes, accroche, digirisk.org) avec trois boîtes et un éventail de
  cartes ; kakémonos assortis derrière la maire et à l'entrée du hall.
- **Portraits officiels** : la maire de la commune, rendue à partir de son propre personnage 3D (même visage,
  même coiffure, écharpe tricolore), de trois quarts devant le drapeau et la bibliothèque.
- **Buste de Marianne** en plâtre sur colonne de marbre moulurée : visage sculpté, tête de trois quarts,
  bonnet phrygien à pointe retombante et cocarde, mèches sur la nuque, drapé et fibule, plaque « RF ».
- **Postes informatiques** : clavier à touches dessinées (AZERTY, pavé numérique), souris galbée à molette sur
  son tapis. Personne ne traverse un meuble : au bureau ou à une table, avant-bras posés sur le plateau,
  tasse et téléphone tenus au-dessus.
- **Une vraie ville autour de la mairie** :
  - en face, une rue commerçante de maisons de ville mitoyennes (enduits de teintes variées, volets, toits de
    tuiles ou d'ardoises à cheminées et lucarnes) avec boucherie, fleuristes, tabac-presse, Café de la Mairie et
    sa terrasse, boulangerie, pharmacie à croix verte ;
  - une rue animée : voitures et fourgons dans les deux sens qui ralentissent aux passages piétons (bandes
    blanches sur l'enrobé), voitures garées, abribus (affiche du jeu de cartes DigiRisk), réverbères, corbeilles,
    boîte aux lettres, vélos ;
  - des véhicules d'après les modèles 3D du « Car Kit » de Kenney (CC0) : berlines, citadine, SUV, fourgon,
    camion de livraison, remis aux proportions réelles, repeints dans des teintes variées (seule la
    carrosserie change de couleur), roues qui tournent ;
  - une circulation qui respecte les gens : chaque véhicule garde ses distances, freine et s'arrête devant le
    visiteur ou un piéton engagé sur sa voie, puis repart ; seule une personne devant le pare-chocs l'arrête —
    quelqu'un déjà à côté de la carrosserie la laisse passer et dégager le passage (sinon chacun attendrait
    l'autre au milieu du passage piéton) ; marquage au sol (axe discontinu, ligne de rive
    interrompue aux passages piétons et au carrefour, ligne de stationnement) ;
  - des corps solides : le visiteur ne traverse ni les personnages ni les voitures, et un passant dont il
    barre le chemin s'arrête et le regarde en attendant ;
  - des pigeons farouches : quand on s'approche à moins de 3 m, le groupe monte presque à la verticale,
    s'éloigne au-dessus des toits, revient et redescend en spirale sur son coin dégagé (jamais à travers un
    bâtiment) ; au sol, ils s'écartent à petits pas pressés des passants ;
  - des sols naturels : enrobé anthracite à granulats, pavés de granit gris-beige, béton neutre, pelouse aux
    brins de plusieurs verts — et une pelouse de fond sous toute la scène (plus de bande vide) ;
  - des passants, des clients en terrasse, un serveur, une cliente devant la boulangerie, un voyageur qui attend
    le bus, une maman qui traverse pour aller chercher son fils.
- **Cohérence des bâtiments** : tous ont une toiture (mansardes de l'hôtel de ville et de l'école, deux pans en
  bac acier à plaques translucides, gouttières et descentes pour les services techniques), une enseigne
  (« Centre technique municipal », « Centre technique environnement », « Accueil de loisirs » gravé dans la
  pierre) et des baies adaptées (bandeaux vitrés aluminium pour les bâtiments d'activité).
- **Pavoisement** : drapeaux français et drapeau de l'Occitanie (croix occitane d'or sur fond rouge) croisés
  au balcon d'honneur, drapeaux français aux balcons des ailes, mâts tricolore et européen sur la place.
- **Un ciel vivant** : nuages doux peints dans le ciel (bords vaporeux, sommets éclairés, bases grisées) qui
  dérivent lentement, à la place des grappes de boules facettées.
- **Des bâtiments habités** : au centre technique municipal, techniciens à leurs écrans, mécanicien à l'établi
  (panneau à outils), magasinier entre les rayonnages, agents de voirie en pause au coin café, vestiaires,
  pneus, stock de cônes et de barrières ; au centre technique environnement, mécanicien au tracteur, agente
  des espaces verts, tondeuse autoportée, râtelier d'outils, sacs de terreau ; à l'accueil de loisirs,
  enfants qui déjeunent à la cantine (plateaux, gestes de repas, bavardages), cuisinières, service, animatrice.
- **Des abords qui racontent le métier** : cour du CTM avec alvéoles de sable, gravier et sel de déneigement,
  benne, fourgon et agent qui charge ; déchets verts et benne au CTE ; point de tri sur le parking ; cour
  d'école avec préau, structure de jeux, marelle et enfants qui jouent au loup ; jardin public avec haies,
  lectrice sur un banc et promeneur.
- **Vie de la place** : habitants qui discutent près de la fontaine, retraité sur un banc, jardiniers à
  l'ouvrage, pigeons bisets (manteau gris bleuté, cou irisé, ailes à deux barres noires, pattes rouges) qui
  marchent par à-coups en hochant la tête, picorent et regardent autour d'eux.

## 7. Mis en œuvre

| Domaine | Fichiers |
| --- | --- |
| Personnages (visage peint, silhouette, coiffures, tenues) | `src/components/3d/models/people.jsx` |
| Animations des personnages (travail, regard, clignements, genoux) | `src/components/editor/EditorNpc.jsx` |
| Rendu réaliste (GTAO, halo, tonemapping) et lumière | `src/components/editor/EditorPostFx.jsx`, `EditorCanvas.jsx` |
| Arbres au vent, pigeons | `src/components/3d/models/natureProps.jsx` |
| Drapeaux, fontaine, horloge, jardinières | `src/components/3d/models/civicProps.jsx` |
| Écrans DigiRisk (captures dans `public/models/digirisk-screens/`), papiers écrits | `src/components/3d/models/heritageProps.jsx` |
| Ville : maisons et commerces, terrasse, abribus, circulation, marquage, toitures, enseignes, école, cours techniques, mobilier urbain | `src/components/3d/models/townProps.jsx` |
| Véhicules (Car Kit de Kenney, CC0 : `public/models/vehicules/`) | `src/components/3d/models/vehicleModels.jsx` |
| Visiteur, corps mobiles et collisions (voitures qui s'arrêtent, passants qui attendent, pigeons) | `src/services/visitState.js`, `EditorWalk.jsx`, `EditorNpc.jsx` |
| Comportements testables hors navigateur : circulation, pigeons | `src/services/trafficLogic.js`, `src/services/pigeonLogic.js` |
| Équipement des ateliers et de l'école (établi, pneus, cônes, vestiaires, coin café, tondeuse, outils de jardin, terreau, enfants à la cantine) | `src/components/3d/models/workProps.jsx` |
| Ciel et nuages | `src/components/3d/SkyDome.jsx` |
| Sols naturels de l'éditeur (enrobé, pavés de granit, béton, pelouse) | `src/components/3d/models/textures.js` |
| Couleurs et habitants de la mairie, plan de la ville | `src/services/editorMairie.js` |

**Contrôle de cohérence de la scène** (audit des 4 et 5 novembre 2026) : les 378 éléments, 65 personnages et
5 bâtiments de la mairie ont été relus — aucun meuble dans un mur ni hors de son bâtiment, aucun trajet
bloqué, rien devant une porte (1,8 m dégagés de part et d'autre de chacune des 49 portes : bâtiments,
cloisons, grillages, entrées des maisons et des commerces ; 3,9 m devant les portails des véhicules, où
seuls les véhicules garés dans leur travée sont admis), aucun personnage dans un obstacle, aucun trou dans les sols, aucune emprise qui se chevauche ;
les 127 éléments du catalogue ont été rendus et comparés à leur emprise de collision ; la circulation et les
pigeons sont simulés hors navigateur (`trafficLogic.js`, `pigeonLogic.js`). Une vraie visite au clavier a
parcouru la scène du trottoir d'en face jusqu'au bureau de la maire, à l'étage : traversée du passage piéton
au milieu des voitures, tour de la fontaine, perron, hall, escalier d'honneur dans les deux sens, galerie.

## 8. Pistes suivantes (non réalisées)

- Textures légères sur le mobilier (veinage du bois, tissu des fauteuils) et sur les sols extérieurs (joints de pavés plus fins).
- Heure de la journée réglable (matin, fin d'après-midi) avec lumières intérieures allumées le soir.
- Postes du jumeau numérique (atelier, entrepôt) repris avec la même palette désaturée.
- Ambiance sonore discrète en visite (fontaine, pas, brouhaha du hall).
