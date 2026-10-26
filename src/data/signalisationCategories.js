const PUBLIC_HOST =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DIGIRISK_PUBLIC_URL) ||
  'https://demodoli.digirisk.com/htdocs';

const SIG_BASE_URL = `${PUBLIC_HOST}/custom/digiriskdolibarr/img/categorieSignalisations`;

/**
 * Catalogue officiel des catégories de signalisations DigiRisk (signalisationCategories.json)
 */
export const SIGNALISATION_CATEGORIES = {
  0: { name: 'Basse température', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-froid-gel.jpg' },
  1: { name: 'Champ magnétique important', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-champ-magnetique.jpg' },
  2: { name: 'Charges suspendues', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-charge-suspendue.jpg' },
  3: { name: 'Danger électrique', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-electricite.jpg' },
  4: { name: 'Emplacement où une atmosphère explosible peut se présenter', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-atmosphere-explosive.jpg' },
  5: { name: 'Matières comburantes', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-comburant.jpg' },
  6: { name: 'Matières corrosives', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-produit-corrosif.jpg' },
  7: { name: 'Matières explosives', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-produit-explosif.jpg' },
  8: { name: 'Matières inflammables ou haute température', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-produit-inflammable.jpg' },
  9: { name: 'Matières nocives ou irritantes', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-produit-nocif.jpg' },
  10: { name: 'Matières radioactives radiations ionisantes', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-radioactivite.jpg' },
  11: { name: 'Matières toxiques', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-produit-toxique.jpg' },
  12: { name: 'Radiations non ionisantes', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-radiations-non-ionisantes.jpg' },
  13: { name: 'Rayonnement laser', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-laser.jpg' },
  14: { name: 'Risque biologique', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-risque-biologique.jpg' },
  15: { name: 'Chute', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-chute.jpg' },
  16: { name: 'Trébuchement', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-trebuchement.jpg' },
  17: { name: 'Véhicules de manutention', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-chariot.jpg' },
  18: { name: 'Divers danger', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-general.jpg' },
  19: { name: 'Divers recommandations', thumbnail: 'recommandations/recommandationsGenerale_s.png' },
  20: { name: 'Bande signalisation', thumbnail: 'AVERTISSEMENT_DANGER/DANGER-bande-signalisation.jpg' },
  21: { name: 'Divers équipement de protection collective', thumbnail: 'epc/preconisations_epc_s.png' },
  22: { name: 'Protection individuelle obligatoire contre les chutes', thumbnail: 'OBLIGATION/OBLIGATION-harnais.jpg' },
  23: { name: "Protection obligatoire de l'ouïe", thumbnail: 'OBLIGATION/OBLIGATION-casque-antibruit.jpg' },
  24: { name: 'Protection obligatoire de la figure', thumbnail: 'OBLIGATION/OBLIGATION-visiere.jpg' },
  25: { name: 'Protection obligatoire de la tête', thumbnail: 'OBLIGATION/OBLIGATION-casque.jpg' },
  26: { name: 'Protection obligatoire de la vue', thumbnail: 'OBLIGATION/OBLIGATION-lunettes.jpg' },
  27: { name: 'Protection obligatoire des mains', thumbnail: 'OBLIGATION/OBLIGATION-gants.jpg' },
  28: { name: 'Protection obligatoire des pieds', thumbnail: 'OBLIGATION/OBLIGATION-chaussures.jpg' },
  29: { name: 'Protection obligatoire des voies respiratoires', thumbnail: 'OBLIGATION/OBLIGATION-protection-voies-espiratoires.jpg' },
  30: { name: 'Protection obligatoire du corps', thumbnail: 'OBLIGATION/OBLIGATION-combinaison.jpg' },
  31: { name: 'Protection obligatoire pour piétons', thumbnail: 'OBLIGATION/OBLIGATION-pieton.jpg' },
  32: { name: 'Obligation de consulter la notice', thumbnail: 'OBLIGATION/OBLIGATION-consulter-notice.jpg' },
  33: { name: 'Divers obligation', thumbnail: 'OBLIGATION/OBLIGATION-general.jpg' },
  34: { name: 'Divers équipement de protection individuelle', thumbnail: 'OBLIGATION/preconisationEPI_s.png' },
  35: { name: "Défense d'éteindre avec de l'eau", thumbnail: 'INTERDICTION/INTERDIT-seau-eau.jpg' },
  36: { name: 'Défense de fumer', thumbnail: 'INTERDICTION/INTERDIT-fumer.jpg' },
  37: { name: 'Eau non potable', thumbnail: 'INTERDICTION/INTERDIT-boire.jpg' },
  38: { name: 'Entrée interdite aux personnes non autorisées', thumbnail: 'INTERDICTION/INTERDIT-entrer.jpg' },
  39: { name: 'Flamme nue interdite et défense de fumer', thumbnail: 'INTERDICTION/INTERDIT-flamme.jpg' },
  40: { name: 'Interdit aux piétons', thumbnail: 'INTERDICTION/INTERDIT-pietons.jpg' },
  41: { name: 'Interdit aux véhicules de manutention', thumbnail: 'INTERDICTION/INTERDIT-chariot.jpg' },
  42: { name: 'Ne pas toucher', thumbnail: 'INTERDICTION/INTERDIT-toucher.jpg' },
  43: { name: 'Divers interdiction', thumbnail: 'INTERDICTION/interdictionGenerale_s.png' },
  44: { name: 'Emplacement alarme à incendie', thumbnail: 'INCENDIE/INCENDIE-alarme.jpg' },
  45: { name: 'Emplacement échelle incendie', thumbnail: 'INCENDIE/INCENDIE-echelle.jpg' },
  46: { name: 'Emplacement équipement incendie', thumbnail: 'INCENDIE/INCENDIE-equipement.jpg' },
  47: { name: 'Emplacement extincteur incendie', thumbnail: 'INCENDIE/INCENDIE-extincteur.jpg' },
  48: { name: 'Emplacement lance à incendie', thumbnail: 'INCENDIE/INCENDIE-lance.jpg' },
  49: { name: 'Emplacement téléphone', thumbnail: 'INCENDIE/INCENDIE-telephone.jpg' },
  58: { name: 'Emplacement civière', thumbnail: 'SECOURS/SECOURS-civiere.jpg' },
  59: { name: 'Secours', thumbnail: 'SECOURS/SECOURS-croix.jpg' },
  60: { name: 'Emplacement défibrillateur', thumbnail: 'SECOURS/SECOURS-defibrillateur.jpg' },
  61: { name: 'Emplacement douche oeil', thumbnail: 'SECOURS/SECOURS-douche-oeil.jpg' },
  62: { name: 'Emplacement douche sécurité', thumbnail: 'SECOURS/SECOURS-douche-securite.jpg' },
  63: { name: 'Emplacement point de rassemblement', thumbnail: 'SECOURS/SECOURS-point-rassemblement.jpg' },
};

export function enrichRiskSign(rawSign) {
  const catPos = Number(rawSign.category ?? 18);
  const cat = SIGNALISATION_CATEGORIES[catPos] || SIGNALISATION_CATEGORIES[18];
  return {
    id: Number(rawSign.id || rawSign.rowid || 0),
    ref: rawSign.ref || `RS${rawSign.id || ''}`,
    fkElement: Number(rawSign.fk_element || 0),
    categoryPosition: catPos,
    categoryName: cat.name,
    iconUrl: `${SIG_BASE_URL}/${cat.thumbnail}`,
    description: rawSign.description || cat.name,
  };
}

/**
 * Signalisations de l'instance de démo DigiRisk (utilisées si l'endpoint REST /digiriskdolibarr/risksigns
 * n'est pas encore exposé dans api_digiriskdolibarr.class.php du serveur distant).
 */
export const DEFAULT_DEMO_RISKSIGNS = [
  // GP5 (id: 22) - Industrie Standard
  {
    id: 1,
    ref: 'RS1',
    fk_element: 22,
    category: 63,
    description: "Point de rassemblement général situé sur le parking principal à l'entrée du site",
  },
  // GP2 (id: 3) - Atelier 1 - Production (fidèle à la capture DigiRisk : RS2, RS3, RS4, RS5)
  {
    id: 2,
    ref: 'RS2',
    fk_element: 3,
    category: 23,
    description:
      "L'atelier métallerie est très bruyant ! Il faut porter des protections pour les oreilles ! C'est obligatoire et des bouchons sont disponibles à chaque entrée de l'atelier pour les visiteurs",
  },
  {
    id: 3,
    ref: 'RS3',
    fk_element: 3,
    category: 25,
    description:
      'Le port du casque de sécurité est suffisant ! À demander à votre accompagnant et/ou au magasinier',
  },
  {
    id: 4,
    ref: 'RS4',
    fk_element: 3,
    category: 30,
    description:
      'La tenue de travail en coton ignifugé est obligatoire pour les soudeurs (Pas synthétique)',
  },
  {
    id: 5,
    ref: 'RS5',
    fk_element: 3,
    category: 28,
    description: 'Les chaussures de sécurité à coque sont obligatoires dans tous les ateliers',
  },
  // UT14 (id: 36) - Soudeurs et chaudronnerie
  {
    id: 6,
    ref: 'RS6',
    fk_element: 36,
    category: 24,
    description: 'Port du masque / visière de soudage et des gants ignifugés obligatoire au poste',
  },
  {
    id: 7,
    ref: 'RS7',
    fk_element: 36,
    category: 3,
    description: 'Armoire électrique haute tension sur la perceuse à colonne et les postes TIG/MIG',
  },
  {
    id: 8,
    ref: 'RS8',
    fk_element: 36,
    category: 47,
    description: 'Extincteur CO2 positionné à proximité immédiate de la zone de soudage oxyacétylénique',
  },
  // UT17 (id: 1917) - Cariste
  {
    id: 9,
    ref: 'RS9',
    fk_element: 1917,
    category: 17,
    description: 'Zone de circulation des chariots élévateurs : priorité aux engins de manutention',
  },
  {
    id: 10,
    ref: 'RS10',
    fk_element: 1917,
    category: 31,
    description: 'Circulation piétonne obligatoire dans les couloirs balisés',
  },
  // GP3 (id: 4) - Atelier 2 - Peinture
  {
    id: 11,
    ref: 'RS11',
    fk_element: 4,
    category: 29,
    description: 'Masque de protection respiratoire obligatoire dans tout le bâtiment peinture',
  },
  {
    id: 12,
    ref: 'RS12',
    fk_element: 4,
    category: 39,
    description: 'Flamme nue strictement interdite à proximité des solvants et poudres',
  },
  // UT1 (id: 5) - Station d'épuration
  {
    id: 13,
    ref: 'RS13',
    fk_element: 5,
    category: 6,
    description: 'Présence de réactifs chimiques corrosifs pour le traitement des effluents',
  },
  // UT2 (id: 6) - Aire de dépotage
  {
    id: 14,
    ref: 'RS14',
    fk_element: 6,
    category: 62,
    description: "Douche de sécurité et rince-œil d'urgence à proximité de la zone de dépotage",
  },
  // UT3 (id: 7) - Accrochage - Décrochage
  {
    id: 15,
    ref: 'RS15',
    fk_element: 7,
    category: 2,
    description: 'Attention aux pièces métalliques suspendues sur le convoyeur aérien',
  },
  {
    id: 16,
    ref: 'RS16',
    fk_element: 7,
    category: 27,
    description: 'Gants de manutention anti-coupure obligatoires pour l’accrochage des pièces',
  },
  // UT18 (id: 2114) - Cabine de peinture poudre
  {
    id: 17,
    ref: 'RS17',
    fk_element: 2114,
    category: 4,
    description: 'Zone ATEX : atmosphère explosible liée au nuage de poudre époxy',
  },
  // GP1 (id: 1) - Bureaux - Administratifs
  {
    id: 18,
    ref: 'RS18',
    fk_element: 1,
    category: 60,
    description: "Défibrillateur automatisé externe (DAE) installé dans le hall d'accueil des bureaux",
  },
  {
    id: 19,
    ref: 'RS19',
    fk_element: 1,
    category: 47,
    description: 'Extincteur à eau pulvérisée dans le couloir central des bureaux',
  },
  // UT4 (id: 8) - Administratif et finance
  {
    id: 20,
    ref: 'RS20',
    fk_element: 8,
    category: 36,
    description: 'Interdiction de fumer et de vapoter dans les locaux administratifs',
  },
  // UT7 (id: 11) - Assistance informatique
  {
    id: 21,
    ref: 'RS21',
    fk_element: 11,
    category: 3,
    description: 'Local baies serveurs et onduleurs sous tension',
  },
  // GP4 (id: 15) - Logistique
  {
    id: 22,
    ref: 'RS22',
    fk_element: 15,
    category: 28,
    description: 'Chaussures de sécurité obligatoires sur les quais d’expédition',
  },
  {
    id: 23,
    ref: 'RS23',
    fk_element: 15,
    category: 17,
    description: 'Manœuvres de camions et transpalettes électriques sur la plateforme logistique',
  },
  // UT12 (id: 17) - Fret aérien
  {
    id: 24,
    ref: 'RS24',
    fk_element: 17,
    category: 2,
    description: 'Manutention de conteneurs de fret et charges lourdes',
  },
];
