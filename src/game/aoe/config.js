/**
 * Cité Prévention — jeu de stratégie en temps réel DigiRisk (page /aoe). Constantes d'équilibrage et catalogue.
 *
 * Mécaniques reprises du genre (aucun nom, visuel ni contenu d'un jeu existant) : des agents qui récoltent des
 * ressources et les rapportent à un dépôt, des bâtiments à construire, une population plafonnée par les logements,
 * des unités et des améliorations produites dans les bâtiments, quatre paliers à franchir, une carte à explorer.
 *
 * Fil rouge : quatre indicateurs standard de la prévention, qui conditionnent les paliers et font le score.
 *   1. Document unique (DU) fait ?  — chaque unité de travail (UT) en activité doit être évaluée par un préventeur ;
 *   2. Salariés sensibilisés        — passés par la salle de formation ;
 *   3. Accidents sur les sites      — un danger non traité près d'un agent peut provoquer un accident ;
 *   4. Registres remontés           — les agents sensibilisés signalent les dangers et rapportent leurs fiches.
 *
 * Ressources : les heures d'équipe (le travail des agents sur les sites, pointé au dépôt), le budget, le temps
 * préventeur (réserve qui se recharge, dépensée en évaluations et en neutralisations) et les remontées.
 *
 * Unités : 1 unité de scène = 1,5 m ; temps en secondes de jeu (×1 = temps réel), affiché en jours de l'année de
 * jeu (un mois = 60 s, donc une seconde = une demi-journée).
 */

export const MAP_HALF = 80; // la carte va de −80 à +80 sur X et Z
export const MONTH = 60; // un mois de jeu = 60 s à ×1
export const DAY = MONTH / 30; // une journée de jeu = 2 s
export const YEAR_MONTHS = 12;
export const POP_MAX = 60;
export const CARRY = 12; // heures pointées par aller-retour
export const CARRY_TECH = 18; // avec « Chariots de manutention »

/** Durée de jeu (s) en jours, pour l'affichage : « 6 jours ». */
export function jours(seconds) {
  const n = Math.max(1, Math.round(seconds / DAY));
  return `${n} jour${n > 1 ? 's' : ''}`;
}

export const RESOURCES = {
  heures: { label: 'Heures d’équipe', unit: 'h' },
  budget: { label: 'Budget', unit: '€' },
  temps: { label: 'Temps préventeur', unit: 'h' },
  remontees: { label: 'Remontées', unit: 'remontées' },
};

export const START = { heures: 500, budget: 150, remontees: 0, temps: 40, agents: 4, preventeurs: 1 };

/**
 * Temps préventeur : réserve en heures, plafonnée et rechargée par préventeur ; chaque seconde de travail d'un
 * préventeur (évaluation, neutralisation) en consomme. Sans réserve, le travail attend.
 */
export const PREV_TIME = { cap: 40, regen: 0.26, use: 0.8 };

/** Unités : vitesse (u/s), vision (u), coût, temps de production (s), bâtiment qui les forme. */
export const UNITS = {
  agent: { label: 'Agent', speed: 3.8, vision: 6, cost: { heures: 50 }, time: 12, from: 'mairie' },
  preventeur: { label: 'Préventeur', speed: 4.2, vision: 10, cost: { heures: 30, budget: 70 }, time: 20, from: 'prevention' },
  sst: { label: 'Sauveteur secouriste (SST)', speed: 4, vision: 7, cost: { heures: 40, budget: 80 }, time: 20, from: 'infirmerie', age: 3 },
};

/**
 * Bâtiments préfaits (ceux de la mairie de démonstration de l'éditeur, et d'autres) : emprise [largeur X, profondeur Z]
 * avant rotation, palier, coût, temps de construction (s, un agent), logements, dépôt de ressources, UT, vision.
 * `risk` : niveau de risque de l'UT du bâtiment (0–1) quand on y travaille.
 */
export const BUILDINGS = {
  mairie: {
    label: 'Hôtel de ville',
    size: [26, 14],
    age: 1,
    buildable: false,
    pop: 10,
    dropoff: ['heures', 'budget', 'remontees'],
    ut: { name: 'Services administratifs', risk: 0.2 },
    vision: 14,
    trains: ['agent'],
    techs: ['accueil', 'appli'],
    income: 0.4, // impôts locaux : 24 € par mois
    hint: 'Centre de la cité : recrute les agents, reçoit les heures pointées et le budget, fait franchir les paliers.',
  },
  maison: { label: 'Maison de ville', size: [6, 6], age: 1, cost: { heures: 30 }, time: 14, pop: 5, vision: 5, income: 0.05, hint: 'Loge 5 personnes de plus ; ses habitants paient des impôts locaux (3 € par mois).' },
  depot: {
    label: 'Dépôt des espaces verts',
    size: [12, 9],
    age: 1,
    cost: { heures: 100 },
    time: 24,
    dropoff: ['heures'],
    ut: { name: 'Dépôt et entretien', risk: 0.35 },
    vision: 7,
    techs: ['outils', 'chariots'],
    hint: 'Les équipes des bosquets y pointent leurs heures sans revenir à l’hôtel de ville ; améliorations d’outillage.',
  },
  cantine: {
    label: 'Cantine',
    size: [10, 8],
    age: 1,
    cost: { heures: 100 },
    time: 24,
    dropoff: ['heures'],
    ut: { name: 'Restauration', risk: 0.3 },
    vision: 7,
    techs: ['jardins'],
    hint: 'Les équipes du jardin et des potagers voisins y pointent leurs heures.',
  },
  potager: {
    label: 'Potager',
    size: [7, 7],
    age: 1,
    cost: { heures: 50 },
    time: 10,
    field: { resource: 'heures', amount: 600, rate: 0.8 },
    utShared: 'jardins',
    vision: 3,
    hint: 'Travail peu risqué : 600 heures d’équipe, replanté automatiquement pour 30 h quand il est épuisé.',
  },
  formation: {
    label: 'Salle de formation',
    size: [14, 10],
    age: 2,
    cost: { heures: 120, budget: 30 },
    time: 30,
    garrison: 6,
    ut: { name: 'Formation', risk: 0.1 },
    vision: 7,
    techs: ['formateurs', 'gestes'],
    hint: 'Sensibilise les agents qu’on y envoie (15 € et 8 jours par agent, 6 à la fois).',
  },
  prevention: {
    label: 'Service prévention',
    size: [10, 8],
    age: 2,
    cost: { heures: 100, budget: 40 },
    time: 26,
    ut: { name: 'Service prévention', risk: 0.1 },
    vision: 8,
    trains: ['preventeur'],
    techs: ['methode', 'plan', 'analyse'],
    hint: 'Recrute des préventeurs (chacun ajoute du temps préventeur) ; méthodes d’évaluation et plan d’actions.',
  },
  atelier: {
    label: 'Centre technique municipal',
    size: [16, 12],
    age: 2,
    cost: { heures: 160, budget: 60 },
    time: 36,
    dropoff: ['heures', 'budget'],
    ut: { name: 'Atelier technique', risk: 0.45 },
    vision: 8,
    techs: ['epi', 'balisage'],
    hint: 'Atelier et garage : équipements de protection, balisage des chantiers.',
  },
  infirmerie: {
    label: 'Infirmerie',
    size: [6, 6],
    age: 2,
    cost: { heures: 90, budget: 90 },
    time: 26,
    ut: { name: 'Infirmerie', risk: 0.1 },
    vision: 6,
    heals: true,
    trains: ['sst'],
    techs: ['suivi'],
    hint: 'Les blessés y récupèrent deux fois plus vite ; forme les sauveteurs secouristes (palier 3).',
  },
  commerce: {
    label: 'Commerce',
    size: [6, 6],
    age: 2,
    cost: { heures: 110 },
    time: 22,
    income: 0.5,
    vision: 5,
    hint: 'Activité locale : rapporte 30 € par mois.',
  },
  point: {
    label: 'Point sécurité',
    size: [2, 2],
    age: 2,
    cost: { heures: 35, budget: 25 },
    time: 8,
    aura: 11,
    vision: 9,
    hint: 'Affichage et balisage : moitié moins de dangers dans un rayon de 11, dangers proches signalés.',
  },
  entrepot: {
    label: 'Entrepôt des EPI',
    size: [12, 10],
    age: 3,
    cost: { heures: 180, budget: 120 },
    time: 34,
    ut: { name: 'Magasin EPI', risk: 0.25 },
    vision: 7,
    techs: ['epc'],
    hint: 'Protections collectives pour tous les sites.',
  },
};

/** Ressources de la carte : bosquets et jardin (heures d'équipe), chantiers de voirie (budget : subventions des travaux). */
export const NODES = {
  arbre: { label: 'Bosquet (élagage)', resource: 'heures', amount: 140, rate: 0.72, ut: 'Espaces verts — élagage', risk: 0.5 },
  chantier: { label: 'Chantier de voirie', resource: 'budget', amount: 900, rate: 0.62, ut: 'Chantier de voirie', risk: 0.62 },
  jardin: { label: 'Jardin de la mairie', resource: 'heures', amount: 600, rate: 0.8, ut: 'Jardins et potagers', risk: 0.15 },
};

/** Paliers de maîtrise (les « âges ») : coût, durée, conditions sur les indicateurs. */
export const AGES = [
  { id: 1, name: 'Réactif', hint: 'On subit les risques : le document unique reste à faire.' },
  {
    id: 2,
    name: 'Conforme',
    cost: { heures: 240, budget: 120 },
    time: 25,
    needs: { du: 0.6, buildings: 2 },
    hint: 'Document unique bien engagé (60 % des UT évaluées) et deux bâtiments de l’âge 1 (dépôt, cantine, potager).',
  },
  {
    id: 3,
    name: 'Proactif',
    cost: { heures: 420, budget: 180 },
    time: 30,
    needs: { du: 1, sensibilises: 0.5, buildings: 2 },
    hint: 'Document unique fait (toutes les UT en activité évaluées), la moitié des salariés sensibilisés, deux bâtiments de l’âge 2.',
  },
  {
    id: 4,
    name: 'Culture de prévention',
    cost: { heures: 400, budget: 320, remontees: 8 },
    time: 40,
    needs: { du: 1, sensibilises: 0.8, registres: 12, calm: 90 },
    hint: 'DU à jour, 80 % de salariés sensibilisés, 12 registres remontés, aucun accident depuis 45 jours.',
  },
];

/** Améliorations (recherches) : bâtiment, palier, coût, durée, effet. */
export const TECHS = {
  accueil: { label: 'Accueil sécurité', at: 'mairie', age: 2, cost: { heures: 120, budget: 80 }, time: 25, hint: 'Les nouveaux agents arrivent sensibilisés.' },
  appli: { label: 'Application DigiRisk', at: 'mairie', age: 2, cost: { budget: 150 }, time: 25, hint: 'Les signalements sont remontés à l’instant, sans retour au dépôt.' },
  outils: { label: 'Outils ergonomiques', at: 'depot', age: 1, cost: { heures: 80, budget: 40 }, time: 20, hint: '+20 % d’heures en élagage, −30 % d’accidents en élagage.' },
  chariots: { label: 'Chariots de manutention', at: 'depot', age: 2, cost: { heures: 120, budget: 60 }, time: 25, hint: 'Moins d’allers-retours : 18 h pointées par trajet au lieu de 12.' },
  jardins: { label: 'Jardins partagés', at: 'cantine', age: 1, cost: { heures: 130 }, time: 20, hint: '+25 % d’heures aux jardins et potagers.' },
  formateurs: { label: 'Formation de formateurs', at: 'formation', age: 2, cost: { budget: 120, heures: 60 }, time: 25, hint: 'Formation en 5 jours au lieu de 8, 9 places au lieu de 6.' },
  gestes: { label: 'Gestes et postures', at: 'formation', age: 3, cost: { budget: 140 }, time: 25, hint: 'Les sensibilisés ont encore 40 % d’accidents en moins.' },
  methode: { label: 'Méthode d’évaluation DigiRisk', at: 'prevention', age: 2, cost: { budget: 100 }, time: 20, hint: 'Évaluation d’une UT deux fois plus rapide, donc deux fois moins de temps préventeur.' },
  plan: { label: 'Plan d’actions', at: 'prevention', age: 2, cost: { budget: 120, remontees: 3 }, time: 25, hint: 'Dangers neutralisés deux fois plus vite ; −25 % de dangers dans les UT évaluées.' },
  analyse: { label: 'Analyse des remontées', at: 'prevention', age: 3, cost: { budget: 160, remontees: 5 }, time: 30, hint: 'Chaque registre remonté retire 3 % de dangers partout (jusqu’à −36 %).' },
  epi: { label: 'Équipements de protection individuelle', at: 'atelier', age: 2, cost: { budget: 140, heures: 60 }, time: 25, hint: '−35 % d’accidents pour tous.' },
  balisage: { label: 'Balisage des chantiers', at: 'atelier', age: 2, cost: { heures: 100, budget: 60 }, time: 20, hint: '−40 % de dangers sur les chantiers de voirie et de construction.' },
  suivi: { label: 'Suivi médical', at: 'infirmerie', age: 2, cost: { budget: 110 }, time: 20, hint: 'Les blessés récupèrent deux fois plus vite.' },
  epc: { label: 'Protections collectives', at: 'entrepot', age: 3, cost: { heures: 160, budget: 200 }, time: 30, hint: '−40 % de dangers sur tous les sites.' },
};

/** Dangers : apparition près des agents au travail, accident, signalement. */
// Calage : sans aucune prévention, environ 7 dangers et 1 accident par mois de jeu en milieu de partie
// (un accident sur cinq à six dangers ignorés) ; avec évaluation, formation et équipements, moins d'un par trimestre.
export const HAZARD = {
  checkEvery: 4, // s : tirage d'apparition par lieu de travail
  spawn: 0.15, // probabilité de base × risque de l'UT
  unevaluated: 1, // facteur si l'UT n'est pas évaluée
  evaluated: 0.45, // facteur si l'UT est évaluée (risques connus, mesures prises)
  evaluatedAccident: 0.8, // dans une UT évaluée, les consignes réduisent aussi la gravité des situations
  maxPerSite: 3,
  life: 90, // s : un danger ignoré finit par disparaître
  radius: 4, // u : portée d'un danger sur les agents
  accidentEvery: 3, // s : tirage d'accident
  accident: 0.0085, // probabilité de base × gravité
  sensibilise: 0.35, // facteur d'accident pour un agent sensibilisé
  revealedFactor: 0.6, // un danger signalé (balisé) est moins traître
  reportRadius: 6,
  report: 0.35, // probabilité de signalement par un agent sensibilisé, par tirage
  observation: 0.02, // par tirage, un agent sensibilisé au travail remonte une observation (≈ 1 toutes les 2,5 min de travail)
  remonteeEffect: 0.96, // chaque remontée traitée réduit le risque de son UT de 4 % (au plus de moitié)
  preventerReveal: 4.5, // u : le préventeur repère lui-même les dangers tout proches
  neutralize: 4, // s de travail d'un préventeur
  autoRange: 12, // un préventeur inoccupé traite de lui-même les dangers signalés à portée
};

export const ACCIDENT = { downtime: 50, cost: 60, defeatAt: 12 };
export const EVAL_TIME = 12; // s pour évaluer une UT (un préventeur)
export const TRAIN = { time: 15, cost: { budget: 15 }, places: 6 };
export const CONSTRUCTION_RISK = 0.45; // UT « Travaux de construction »

/** Temps forts : pics d'activité (plus de dangers) et contrôle de l'inspection du travail. */
export const EVENTS = [
  { at: 3.5 * MONTH, kind: 'rush', warn: 20, duration: 45, label: 'Pic d’activité' },
  { at: 6.5 * MONTH, kind: 'rush', warn: 20, duration: 45, label: 'Pic d’activité' },
  { at: 8 * MONTH, kind: 'inspection', label: 'Contrôle de l’inspection du travail' },
  { at: 9.5 * MONTH, kind: 'rush', warn: 20, duration: 45, label: 'Pic d’activité' },
];

/** Score sur 1 000 : 250 par indicateur. Étoiles à 450, 650, 850. */
export const SCORE = { registresTarget: 15, stars: [450, 650, 850] };
