# Cité Prévention — règles du jeu (page `/aoe`)

Jeu de stratégie en temps réel DigiRisk. Il reprend les **principes du genre** (pas de nom, de visuel ni de contenu
d'un jeu existant) : des agents qui travaillent sur des sites et rapportent le fruit de leur travail au dépôt, des
bâtiments à construire, une population plafonnée par les logements, des unités et améliorations produites dans les
bâtiments, quatre paliers à franchir, une carte à explorer. Le fil rouge, ce sont **quatre indicateurs standard de
prévention** : ils conditionnent les paliers et font le score.

Moteur : `src/game/aoe/` (pur JavaScript, testable sous Node) — `config.js` (toutes les valeurs), `engine.js`
(partie, commandes, indicateurs, guide), `grid.js` (déplacements), `personas.js` (robots de test). Interface :
`src/components/aoe/` (dont `aoeTutorial.js` pour le didacticiel). Tests : `node scripts/simulate-aoe.mjs` (voir
[`personas.md`](personas.md)).

## Le temps de jeu

Une année de jeu dure 12 minutes : **un mois passe en une minute, une journée en deux secondes**. Toutes les durées
affichées sont en jours de jeu (évaluation d'une UT : 6 jours ; arrêt après un accident : 25 jours ; formation :
8 jours…). Le didacticiel ne compte pas : le calendrier ne démarre qu'à sa fin.

## Les quatre indicateurs

| Indicateur | Ce qui le fait avancer | Ce qu'il change en jeu |
| --- | --- | --- |
| **Document unique fait ?** (UT évaluées / UT en activité) | Le préventeur va sur l'unité de travail et l'évalue (6 jours, 3 avec la méthode DigiRisk ; environ 10 h de temps préventeur). Chaque bâtiment, chantier de voirie, bosquet, jardin et l'activité de construction est une UT ; une UT entre dans le DU quand l'activité démarre (on peut l'évaluer pendant la construction). | Dans une UT évaluée, 55 % de dangers en moins et des dangers moins traîtres. Conditionne les paliers 2 (60 %), 3 et 4 (100 %). Contrôle de l'inspection du travail au mois 8 : DU complet → subvention, sinon mise en demeure (−250 €). |
| **Salariés sensibilisés** (sensibilisés / effectif) | Envoyer des agents en salle de formation (15 €, 8 jours, 6 places). Avec « Accueil sécurité », les recrues arrivent sensibilisées. | Un agent sensibilisé porte gilet et casque (visible), a 65 % d'accidents en moins, signale les dangers et propose des améliorations. Paliers 3 (50 %) et 4 (80 %). |
| **Accidents sur les sites** | Un danger non traité à moins de 4 unités d'un agent au travail peut le blesser. | Agent arrêté 25 jours (moins avec l'infirmerie, le suivi médical, un sauveteur secouriste à proximité), −60 €. Palier 4 : aucun accident depuis 45 jours. **12 accidents : l'inspection suspend l'activité (défaite).** |
| **Registres remontés** | Un agent sensibilisé signale un danger proche ou propose une amélioration ; la fiche part au registre au retour au dépôt (tout de suite avec l'application DigiRisk). | Chaque fiche fait baisser de 4 % le risque de son UT (jusqu'à la moitié) et rapporte une « remontée » (ressource des améliorations). Palier 4 : 12 registres. |

**Score sur 1 000** (fin d'année ou victoire) : 250 par indicateur — DU évalué, part de sensibilisés,
`250 × (1 − accidents / 12)`, `250 × min(1, registres / 15)`. Étoiles à 450, 650 et 850.

## Les ressources

| Ressource | D'où elle vient | À quoi elle sert |
| --- | --- | --- |
| **Heures d'équipe** (h) | Le travail des agents sur les bosquets (élagage), le jardin et les potagers, pointé au dépôt le plus proche (hôtel de ville, dépôt des espaces verts, cantine, centre technique) : 12 h par aller-retour, 18 avec les chariots | Construire, recruter, franchir les paliers |
| **Budget** (€) | Chantiers de voirie (subventions des travaux), impôts locaux de l'hôtel de ville et des maisons, commerces, subvention de l'inspection | Formations, améliorations, préventeurs, paliers ; un accident coûte 60 € |
| **Temps préventeur** (h) | Réserve de 40 h par préventeur, rechargée en continu par chaque préventeur | Chaque seconde d'évaluation ou de neutralisation en consomme ; réserve vide, le travail attend. Un préventeur de plus (service prévention) agrandit et recharge plus vite la réserve ; la méthode DigiRisk et le plan d'actions la font durer. |
| **Remontées** | Les fiches des agents sensibilisés arrivées au registre | Améliorations avancées (plan d'actions, analyse des remontées), palier 4 |

Le jardin et les potagers sont le travail le moins risqué ; les bosquets rapportent plus mais exposent davantage ; les
chantiers de voirie sont les plus dangereux. Un potager épuisé est replanté pour 30 h.

## Principes du genre repris

- **Travail et dépôt** : chaque agent envoyé sur un site y travaille puis revient pointer ses heures (ou rapporter la
  subvention du chantier) au dépôt le plus proche ; un dépôt près des sites raccourcit les trajets.
- **Population** : hôtel de ville 10, maison 5, plafond 60. Agents recrutés à l'hôtel de ville (50 h d'équipe, 6 jours).
- **Construction** : les agents construisent (plusieurs vont plus vite) ; pose au sol avec aperçu, rotation.
- **Paliers** (les « âges ») franchis à l'hôtel de ville, chacun débloque bâtiments, unités et améliorations :
  1. *Réactif* — hôtel de ville, maisons, dépôt, cantine, potagers ;
  2. *Conforme* (DU 60 %, deux bâtiments de l'âge 1, 240 h d'équipe, 120 €) — salle de formation, service
     prévention, centre technique, infirmerie, commerce, point sécurité ;
  3. *Proactif* (DU fait, 50 % de sensibilisés, deux bâtiments de l'âge 2, 420 h d'équipe, 180 €) — entrepôt des
     EPI, sauveteurs secouristes, améliorations avancées ;
  4. *Culture de prévention* (DU fait, 80 % de sensibilisés, 12 registres, aucun accident depuis 45 jours, 400 h
     d'équipe, 320 €, 8 remontées) — **victoire**.
- **Unités** : agent (travaille sur les sites, construit, se forme), préventeur (évalue, neutralise les dangers,
  éclaireur à grande vision ; inoccupé, il traite de lui-même les dangers signalés proches), sauveteur secouriste
  (palier 3).
- **Améliorations** dans les bâtiments : accueil sécurité, application DigiRisk, outils ergonomiques, chariots,
  jardins partagés, formation de formateurs, gestes et postures, méthode d'évaluation, plan d'actions, analyse des
  remontées, EPI, balisage des chantiers, suivi médical, protections collectives.
- **Exploration** : brouillard d'exploration (zones inconnues en noir, zones connues hors de vue assombries) ;
  les sites se découvrent en envoyant un préventeur ou un agent.
- **« Attaques »** : les dangers, plus nombreux pendant trois pics d'activité annoncés (mois 3,5 ; 6,5 ; 9,5).
  Un premier presqu'accident, vers le 25ᵉ jour, montre tout de suite la boucle danger → préventeur.

## Bâtiments préfaits

Composés avec les modèles de l'éditeur de site (`src/components/aoe/aoePrefabs.js`) :

| Bâtiment | Modèle | Rôle |
| --- | --- | --- |
| Hôtel de ville | Extérieur de la mairie de démonstration (pierre de taille, avant-corps, portail d'honneur, balcons pavoisés, toitures mansardées, campanile, fronton « MAIRIE ») | Centre : recrute, reçoit heures et budget, paliers, impôts locaux |
| Maison de ville | Maisons de la rue commerçante | Logements (+5), impôts locaux |
| Commerce | Maisons à commerce (boulangerie, café, fleuriste…) | 30 € par mois |
| Infirmerie | Pharmacie à croix verte | Blessés soignés deux fois plus vite, sauveteurs secouristes |
| Dépôt des espaces verts | Bâtiment du CTE (bardage vert, toiture bac acier) | Pointage des heures près des bosquets, outillage |
| Centre technique municipal | Bâtiment du CTM (bardage, portails) | Pointage des heures et du budget, EPI, balisage des chantiers |
| Salle de formation | Bâtiment de l'ALP (brique, toiture mansardée) | Sensibilisation des agents |
| Cantine | Brique, toiture à deux pans | Pointage des heures du jardin et des potagers, jardins partagés |
| Service prévention | Enduit, toiture à deux pans | Préventeurs (temps préventeur), méthode, plan d'actions, analyse des remontées |
| Point sécurité | Panneau d'affichage et panneau d'avertissement | Moitié moins de dangers à 11 unités, signalements facilités |
| Entrepôt des EPI | Bardage gris | Protections collectives |
| Potager | Champ cultivé | 600 h de travail peu risqué, replanté automatiquement |

## Apprendre à jouer

- **Didacticiel** (accueil, bouton « Didacticiel », mis en avant tant qu'il n'a pas été fait) : une vraie partie
  guidée en 15 étapes (déplacer la vue, sélectionner, mettre au travail, agents inoccupés, ressources, préventeur,
  évaluer une UT, neutraliser un danger, accidents, construire, recruter, paliers, guide). Chaque étape montre où
  agir (flèche jaune dans la 3D, bouton entouré) et attend que ce soit fait ; les explications mettent la partie en
  pause. Pendant le didacticiel, ni danger aléatoire ni accident, et le calendrier de l'année est arrêté ; à la fin
  (ou avec « Passer »), la partie continue normalement.
- **Aide « Comment jouer »** (bouton ? en haut à droite, Échap pour fermer) : but, souris, clic droit, clavier,
  une partie en cinq temps, ressources ; elle met la partie en pause et permet de relancer le didacticiel.
- Le panneau **« Prochaine étape »** propose à tout moment le conseil utile, exécutable d'un clic (« Faire »).
- La **démo automatique** (accueil) fait jouer la partie par le robot équilibré ; « Prendre la main » rend le contrôle.

## Commandes

Clic gauche : sélectionner (glisser pour plusieurs agents, Maj pour ajouter) · clic droit : ordre contextuel
(travailler sur un site, construire, aller se former, évaluer l'UT, neutraliser un danger, se déplacer) · ZQSD / WASD /
flèches, bouton du milieu : déplacer la vue · molette : zoom · H : préventeur suivant · point : agents inoccupés · F :
centrer · R : pivoter le bâtiment à poser · Échap : annuler · Espace : pause · 1 / 2 / 3 : vitesse ×1 / ×2 / ×4.

*Modèle simplifié à visée pédagogique : il ne remplace pas l'évaluation des risques d'une collectivité.*
