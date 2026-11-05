# DigiRisk Game — Pistes pour un jeu de gestion de la prévention

Document de travail : idées de jeu à partir de la base existante (jumeau numérique 3D, données DigiRisk, salariés
Dolibarr, visite en première personne, éditeur de site). Le cahier des charges qui en découle est dans
[`cahier-des-charges.md`](cahier-des-charges.md).

## 1. Le principe retenu : un jeu de stratégie / gestion en temps réel

On reprend les codes du genre (type Age of Empires, Anno, Settlers) sans copier un jeu existant : des **travailleurs
à affecter**, des **ressources** à faire rentrer, des **constructions** à poser sur la carte, des **recherches** et des
**paliers** à franchir. Tout se joue en temps réel avec pause, sur le site 3D du jumeau.

| Code du genre | Traduction DigiRisk |
| --- | --- |
| Carte, zones inexplorées | Le site 3D ; une UT non évaluée (ou évaluée il y a plus d'un an) cache une partie de ses risques |
| Travailleurs / villageois | Les **salariés réels** de l'entité (Dolibarr), chacun avec son poste et son UT |
| Récolte de ressources | La **production** des UT fait rentrer le chiffre d'affaires (€) |
| Moral de la population | L'**envie** des salariés |
| Attaques ennemies | Les **dangers** : presqu'accidents, accidents, événements (canicule, contrôle, commande urgente) |
| Défenses, bâtiments | Les **mesures de prévention** posées sur la carte : garde-corps, allées piétonnes, extincteurs, douches… |
| Technologies | L'**organisation** : accueil sécurité, plan de circulation, permis feu, causeries, DigiRisk… |
| Âges | Les **paliers de maîtrise** : Réactif → Conforme → Proactif → Culture de prévention |

Ce que la base apporte déjà : la carte (plan calculé pour n'importe quel DUER), la couleur des UT selon la cotation,
le gyrophare des risques critiques, les salariés qui marchent sur un graphe piéton, les camions de livraison (image
de l'activité), les extincteurs et trousses avec dates de vérification, le catalogue d'équipements de sécurité de
l'éditeur, et la visite à pied avec inspection des postes.

## 2. Les quatre mesures demandées

### L'argent (trésorerie)
- **Recettes** : chaque salarié au travail dans une UT produit une marge par jour, modulée par son envie (cadence).
  Les camions qui partent des quais rendent cette production visible.
- **Dépenses** : frais fixes mensuels, mesures (achat + entretien), formations, EPI à renouveler, recherches, passage
  de palier, recrutements.
- **Coût des accidents** : coût direct, salarié absent (donc ne produit plus), équipe démotivée, et une **cotisation
  AT/MP** qui augmente avec les accidents (modèle simplifié). Le joueur sent que la prévention rapporte à moyen terme.
- **Le vrai arbitrage** : le temps des salariés. Un salarié en formation, en évaluation ou sur un chantier ne produit
  pas, comme un villageois qui construit au lieu de récolter. On peut aussi payer un prestataire, plus cher.
- Idées : subvention prévention à saisir pendant une fenêtre limitée, commande urgente à accepter ou refuser, audit
  client qui rapporte un contrat si le palier est atteint.

### L'envie des personnes
- Une jauge par salarié (0–100), une moyenne par UT et pour le site, avec une humeur visible au-dessus des têtes.
- **Ce qui la fait monter** : être consulté pour l'évaluation de son poste, être formé, voir de vraies protections
  collectives, voir la direction passer sur le terrain, voir ses remontées traitées, franchir un palier.
- **Ce qui la fait baisser** : poste dangereux, EPI contraignants, risques psychosociaux, collègues absents donc
  surcharge, accident dans le bâtiment, remontées ignorées, canicule non gérée.
- **Ce qu'elle change** : la cadence (donc l'argent), le **port réel des EPI** (un EPI non porté ne protège pas), les
  remontées spontanées de dangers, l'absentéisme, les démissions et, au pire, une crise sociale.
- Tension intéressante : l'EPI est la mesure la moins chère, mais il baisse un peu l'envie et ne marche que si l'envie
  est là. La protection collective coûte cher mais protège tout le monde sans dépendre de personne. Le jeu fait donc
  découvrir les principes généraux de prévention sans les réciter.

### Les différents risques
- Les risques viennent du **DUER réel** (catégories INRS DigiRisk, cotation 0–100, critères Gravité, Exposition,
  Occurrence, Formation, Protection) : jouer sur son propre document unique est le gros point fort.
- Chaque famille de risque a son comportement : rare mais grave (chute de hauteur, incendie, électricité), fréquent et
  lent (TMS, postures : maladie professionnelle après une exposition prolongée), lié aux déplacements (routier, selon
  les VRP et coursiers), lié au site (circulation chariots / piétons), lié à l'envie (risques psychosociaux, dans les
  deux sens).
- **Risques cachés** : en plus des risques du DUER, chaque type de poste a des risques probables (soudure : incendie,
  fumées, bruit…). Tant que l'UT n'est pas évaluée, ils restent cachés et dangereux. On les découvre par une
  évaluation, un presqu'accident analysé, une remontée de salarié ou une visite à pied.
- **Presqu'accidents** : des alertes « ! » apparaissent au-dessus des postes et disparaissent si on ne s'en occupe
  pas. Les traiter révèle des risques, rassure l'équipe et propose une mesure. C'est la micro-gestion du jeu.
- Chaque mesure agit sur un critère DigiRisk, et la couleur de l'UT change en direct sur la carte :
  formation → Formation, EPI → Protection, protection collective → Occurrence et Protection, organisation →
  Exposition, substitution → Gravité, suppression → le risque disparaît.

### Les niveaux de maîtrise
- **Par risque**, un niveau visible : *Non maîtrisé*, *Partiellement maîtrisé* (seulement formation ou EPI),
  *Maîtrisé* (protection collective ou organisation, cotation ≤ 50), *Maîtrise durable* (substitution ou suppression).
- **Pour l'entreprise**, les paliers jouent le rôle des âges :
  1. **Réactif** : on subit, le DUER est à rafraîchir.
  2. **Conforme** : DUER à jour, plus de risque critique sans mesure, vérifications à jour.
  3. **Proactif** : plan d'actions, formation, protections collectives, presqu'accidents analysés.
  4. **Culture de prévention** : salariés impliqués (relais sécurité), plus de risque rouge, envie élevée.
- Chaque palier coûte de l'argent et du temps, demande des conditions, et débloque de nouvelles mesures et recherches.
  On le voit sur le site : signalétique, drapeaux du rond-point, couleurs.

## 3. Moments forts (événements)
- **Contrôle de l'inspection du travail** : UT non évaluées, risques critiques sans action → observations, mise en demeure, amende.
- **Canicule** : chaleur, envie en baisse ; eau, pauses et horaires adaptés coûtent de la production.
- **Commande urgente** : plus de production, plus d'exposition, équipe fatiguée. Accepter ou refuser ?
- **Nouvel embauché ou intérimaire** : non formé, donc plus exposé, sauf avec l'accueil sécurité.
- **Machine neuve** : un nouveau risque arrive sur une UT, à évaluer.
- **Réunion du CSE** : choisir une demande parmi trois (coût, envie, risque).
- **Visite de la médecine du travail** : fait ressortir des TMS ou des risques psychosociaux cachés.
- **Subvention prévention** : une partie des protections collectives achetées pendant 30 jours est remboursée.
- **Audit client** : si le palier est suffisant et qu'il n'y a pas eu d'accident récent, un meilleur contrat.
- **Accident grave** sur un risque connu et laissé sans mesure → « faute inexcusable » (défaite en mode normal).

## 4. Idées pour plus tard
- **Jouer son propre site** : dessiner le site dans l'éditeur (`/edit`), puis le jouer ; les postes posés apportent
  leurs risques types et les équipements posés comptent comme des mesures déjà en place.
- **Évaluer à pied** : passer en visite 1re personne pour évaluer soi-même une UT (plus rapide, bonus d'envie).
- **Exporter le plan d'actions joué** (JSON / CSV) pour le reprendre dans DigiRisk.
- **Défis** : même entité, même graine, classement des scores.
- **Coopération ou compétition** : deux entreprises sur deux sites.
- **Mode formation** pour les clients Evarisk : un scénario guidé sur leur propre DUER.

## 5. Autres concepts envisagés (non retenus pour la V1)
- **Tour par tour mensuel** (« Préventeur en chef ») : plus simple à coder, mais moins vivant que le temps réel demandé.
- **Chasse aux dangers en 1re personne** : gardée comme action dans le jeu (évaluer à pied), pas comme jeu principal.
- **Bâtisseur** (concevoir un site sûr dans l'éditeur, puis simuler) : prévu pour un lot ultérieur.
- **Jeu de cartes CSE** : gardé comme événement (réunion du CSE).
