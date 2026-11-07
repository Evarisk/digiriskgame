# Cité Prévention — tests d'intérêt de jeu avec des personas

Objectif : vérifier, avant les tests avec de vrais joueurs, que le jeu intéresse chacun des publics visés et que
sa leçon passe (la prévention paie, l'ignorer mène à l'échec). Chaque persona est jouée par un **robot** qui
utilise uniquement les commandes du joueur (`applyCommand`) avec le style et la fréquence de décision du profil
(`src/game/aoe/personas.js`). Le script `scripts/simulate-aoe.mjs` joue des années complètes, mesure résultats et
rythme, et vérifie des **objectifs d'intérêt** fixés par persona (code de sortie 1 si l'un n'est pas atteint).

```
node scripts/simulate-aoe.mjs --seeds 30 --check        # 6 personas × 30 parties, ≈ 1 min
node scripts/simulate-aoe.mjs --only claire --json r.json
```

## Les personas

| Persona | Profil | Ce qu'elle attend | Comment le robot joue |
| --- | --- | --- | --- |
| **Claire**, maire d'une commune de 3 000 habitants | Visiteuse du salon des maires, ne joue jamais aux jeux vidéo | Comprendre en 10 minutes à quoi sert le document unique et ce que la prévention change aux accidents ; ne pas se sentir perdue | Suit le panneau « Prochaine étape » (une décision toutes les 8 s) |
| **Karim**, responsable prévention (QSE) | Connaît le DUER par cœur, joueur occasionnel | Retrouver la logique du métier : évaluer d'abord, former, traiter les remontées ; que les bonnes pratiques paient | Évalue toutes les UT au plus tôt (même avant l'ouverture), forme tout le monde, deux préventeurs, améliorations de prévention d'abord |
| **Sophie**, directrice générale des services | Pilote le budget, joueuse de jeux de gestion | Voir la prévention comme un investissement : arbitrer budget, temps des agents, indicateurs | Économie d'abord (commerces, outillage, effectif), prévention juste ce qu'il faut pour les paliers |
| **Lucas**, joueur de stratégie confirmé | Joue aux jeux de stratégie en temps réel | De la profondeur : ordre de construction, rythme ; une partie qui ne se gagne pas toute seule | Ordre de construction serré, paliers au plus tôt, conditions remplies au plus juste (point sécurité comme second bâtiment), une décision par seconde |
| **Marc**, agent technique « la production d'abord » | La paperasse l'agace | Que ça bouge : produire, construire | Récolte, construit, recrute ; n'évalue rien, ne forme personne, ignore les dangers |
| **Démo du stand** | Commercial Evarisk qui laisse tourner le jeu | Une partie qui montre tous les mécanismes et les quatre indicateurs en une dizaine de minutes, et qui finit bien | Joueur équilibré (c'est la « Démo automatique » de l'accueil) |

## Résultats (30 parties par persona, difficulté unique, 5 novembre 2026)

Économie « heures d'équipe, budget, temps préventeur » (voir [`regles.md`](regles.md)). Les durées sont en minutes
réelles (une minute = un mois de jeu).

| Persona | Victoire | Défaite | Score moyen | ≥ 1 étoile | Victoire en | Palier 2 / 3 (min) | Sensibilisés | Accidents | Registres | Décisions / min |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Claire (débutante guidée) | 60 % | 0 % | 944 | 100 % | 10,4 min | 2,6 / 7,3 | 93 % | 1,6 | 19,7 | 6 |
| Karim (prévention) | 100 % | 0 % | 961 | 100 % | 8,6 min | 2,0 / 6,6 | 100 % | 1,4 | 29,9 | 25 |
| Sophie (budget) | 100 % | 0 % | 946 | 100 % | 8,9 min | 2,3 / 6,0 | 96 % | 1,8 | 27,5 | 25 |
| Lucas (optimisation) | 100 % | 0 % | 953 | 100 % | 8,3 min | 2,0 / 5,8 | 94 % | 0,8 | 27,0 | 29 |
| Marc (sans prévention) | 0 % | 97 % | 13 | 0 % | — | jamais | 5 % | 12,0 | 0 | 13 |
| Démo du stand | 100 % | 0 % | 964 | 100 % | 8,3 min | 2,0 / 6,4 | 100 % | 1,2 | 28,8 | 25 |

Dangers par partie (apparus / repérés / neutralisés / disparus sans être traités) : Claire 12,3 / 10,7 / 10,1 / 1,8 —
Karim 12,6 / 11,9 / 10,9 / 1,2 — Marc 19,9 / 9,4 / 2,5 / 12,3. Marc ne franchit **jamais** le palier 2 (le DU à
60 % le bloque), perd presque toujours vers 8 minutes (12 accidents) et, quand il arrive jusqu'à l'inspection, il est
mis en demeure (13 parties sur 13).

Temps préventeur : le préventeur attend que sa réserve se recharge 23 s par partie chez Karim (il évalue tout, même
les bâtiments en chantier), une dizaine de secondes chez Claire et la démo, 4 à 5 s chez Sophie et Lucas. La ressource
pèse donc surtout sur ceux qui font beaucoup de prévention avec un seul préventeur : c'est ce qui rend le second
préventeur (service prévention) et la méthode DigiRisk intéressants.

**Les 18 objectifs d'intérêt sont atteints** (débutante accompagnée et jamais vaincue, expert récompensé, pas de
victoire sans prévention, démo complète en moins de 12 minutes, progression débutante < expert ≤ confirmé…).

## Ce que les tests ont révélé — et ce qui a été corrigé

Les premiers passages échouaient sur 13 objectifs sur 18. Chaque écart a été tracé partie par partie
(répartition des agents, production par ressource, conseils suivis) avant d'être corrigé :

1. **Trop d'accidents d'entrée** : défaite vers la 5ᵉ minute, avant même de pouvoir former qui que ce soit. Taux
   de dangers et d'accidents recalés (un accident pour cinq à six dangers ignorés).
2. **Aucun registre remonté** : dans une UT évaluée, les dangers étaient repérés d'office — plus rien à signaler,
   et mieux on prévenait, moins il y avait de remontées (l'inverse de la réalité). Désormais, le DU fait baisser
   les dangers mais un danger nouveau doit être repéré sur le terrain ; les sensibilisés remontent aussi des
   améliorations, et chaque fiche fait baisser le risque de son UT.
3. **Un piège dans le DU** : l'UT « Travaux de construction » ne pouvait s'évaluer que pendant un chantier, le DU
   restait bloqué et l'inspection sanctionnait. Elle s'évalue désormais aussi sur plans à l'hôtel de ville ; une
   UT de bâtiment peut être évaluée dès la pose (avant l'ouverture, comme le veut la règle).
4. **Économie trop lente pour 12 minutes** (palier 3 vers 11 minutes) : impôts locaux, récoltes et coûts recalés,
   potagers replantés automatiquement.
5. **Une erreur de génération de carte**, révélée par un écart entre graines : la marge autour de l'hôtel de ville
   empêchait de placer le bosquet et le chantier « en vue » ; certaines parties démarraient sans ressource visible.
6. **Le guide de la débutante** (panneau « Prochaine étape ») avait quatre défauts, tous vus sur les parties de
   Claire : il oubliait les agents inoccupés trop loin d'une ressource, ne proposait jamais de rééquilibrer les
   récoltes (900 repas en stock, matériaux à zéro pendant 4 minutes), ne proposait pas de potager quand les repas
   s'épuisaient, et faisait recruter au lieu de construire ou d'épargner pour le palier. Corrigé dans le moteur
   (`nextHint`) : il sert aussi aux vrais joueurs.
7. **Peu de tension pour un bon joueur** (5 dangers par an) : dangers plus fréquents mais chacun moins grave, et un
   premier presqu'accident scénarisé vers le 25ᵉ jour (50 s) qui montre la boucle danger → préventeur dès la
   première minute.
8. **Des ressources sans rapport avec le métier** (retour du 5 novembre) : repas et matériaux venaient des jeux de
   stratégie classiques. Ils sont remplacés par les **heures d'équipe** (le travail des agents sur les sites) et le
   **temps préventeur** (réserve consommée par les évaluations et les dangers). Premier calage : le préventeur ne
   manquait jamais de temps (0 s d'attente pour tous), la ressource ne servait à rien ; deuxième : il en manquait
   assez pour que la débutante ne gagne plus qu'une partie sur quatre. Réglage retenu entre les deux (40 h de
   réserve par préventeur, recharge 0,26 h/s, 0,8 h par seconde de travail).
9. **Des durées en secondes dans un jeu qui compte en mois** (même retour) : toutes les durées sont désormais affichées
   en jours de jeu (une seconde = une demi-journée).
10. **Des agents « en marche » pendant qu'ils travaillaient**, révélé en testant le didacticiel : quand le point
    d'approche d'un site était inaccessible, l'agent travaillait sans quitter l'état « en déplacement », et dangers
    comme accidents l'ignoraient. Sur certaines cartes, les équipes du jardin ne croisaient donc jamais de danger.
    Corrigé dans le moteur : un peu plus de dangers pour tous (Claire en croise 12 au lieu de 10), et Marc, qui
    n'en traite aucun, perd désormais presque toutes ses parties.

Les robots eux-mêmes ont été corrigés quand ils jouaient moins bien qu'un humain sensé (préventeur envoyé explorer
au lieu d'évaluer, recrutements sans réserve pour l'objectif, répartition des récoltes au hasard).

## Lecture par persona

- **Claire (maire)** — L'expérience visée est atteinte : jamais de défaite, toujours au moins une étoile, six parties
  sur dix gagnées en suivant le guide, et la boucle des dangers vécue dès la première minute. Elle a au moins un
  accident dans 73 % des parties (1,6 en moyenne) : l'enjeu est visible sans être punitif. *À vérifier avec de vraies
  personnes : un débutant humain lit plus lentement qu'un robot (une décision toutes les 8 s) ; la partie de
  12 minutes peut être longue au stand → didacticiel (5 minutes, calendrier arrêté) puis démo.*
- **Le didacticiel** — Vérifié avec un joueur simulé qui suit chaque étape sur 10 cartes : toujours terminé, un seul
  danger (celui de la leçon), aucun accident, calendrier arrêté pendant l'apprentissage puis reprise normale de
  l'année et des dangers. Ce test a révélé le défaut n° 10 (le danger de la leçon n'apparaissait parfois qu'au bout
  de plusieurs minutes).
- **Karim (prévention)** — Ses réflexes de métier sont récompensés : DU fait avant l'inspection dans toutes les
  parties, victoire en 8,6 minutes, peu d'accidents. C'est lui qui manque le plus de temps préventeur : il recrute un
  second préventeur. Le vocabulaire DigiRisk (UT, évaluation, registres, plan d'actions) est respecté.
- **Sophie (budget)** — Une stratégie économique gagne aussi, mais seulement parce que les paliers l'obligent à
  faire de la prévention : on ne peut pas progresser sans DU ni sensibilisation. Le message « la prévention est un
  passage obligé, pas un coût à part » passe.
- **Lucas (joueur confirmé)** — Le jeu ne se gagne pas sans prévention (Marc) ; l'optimisation (point sécurité comme
  second bâtiment, formation par lots) fait gagner quelques secondes, pas une stratégie dominante. *Limite : les
  scores des joueurs actifs se tassent entre 940 et 965 ; ce qui les distingue est surtout le temps de victoire.*
- **Marc (production d'abord)** — Échec systématique et explicable : bloqué au palier 1, 12 accidents, défaite
  vers 8 minutes dans 97 % des parties. C'est le contre-exemple pédagogique attendu.
- **Démo du stand** — Toujours gagnée, en 8,3 minutes en moyenne, avec une dizaine de dangers repérés et neutralisés
  et près de 30 registres : tous les mécanismes et les quatre indicateurs défilent à l'écran.

## Pistes (non réalisées)

- **Départager les bons joueurs** : bonus de temps ou classement par durée de victoire, défis à graine imposée.
- **Niveaux de difficulté** (facile / normal / expert) : guide plus ou moins présent, fréquence des dangers,
  seuil de défaite.
- **Tests avec de vraies personnes** de chaque profil (5 minutes au salon, partie complète en formation),
  en notant les moments de blocage ; les robots ne disent rien de la lisibilité de l'écran.
- **Évaluer à pied** (visite en première personne de l'éditeur) pour une UT ; jouer sur son propre site dessiné dans
  l'éditeur ou sur son propre DUER (voir `docs/jeu-gestion/`).
