/**
 * Vérifications périodiques des équipements de sécurité visibles en 3D (extincteurs, trousses de secours).
 *
 * Dans un premier temps, les dates sont des données de démonstration : déterministes pour un équipement
 * donné (clé stable : élément DigiRisk + emplacement du modèle) et calculées par rapport à la date du jour.
 * Elles sont signalées comme telles dans l'infobulle ; une source réelle pourra remplacer `equipmentCheck`.
 */

const DAY = 24 * 60 * 60 * 1000;
const SOON_DAYS = 30;

export const EQUIPMENT_KINDS = {
  extinguisher: {
    label: 'Extincteur',
    check: 'Vérification annuelle',
    lastLabel: 'Dernière vérification',
    nextLabel: 'Prochaine vérification',
    periodDays: 365,
    models: ['Eau pulvérisée + additif 6 L', 'CO₂ 2 kg', 'Poudre ABC 6 kg'],
  },
  firstaid: {
    label: 'Trousse de secours',
    check: 'Contrôle du contenu (semestriel)',
    lastLabel: 'Dernier contrôle',
    nextLabel: 'Prochain contrôle',
    periodDays: 182,
    models: ['Trousse murale 10 personnes', 'Trousse atelier 20 personnes'],
  },
};

/** Empreinte d'une chaîne ramenée dans [0, 1[ (FNV-1a). */
function hash01(text, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * État de vérification d'un équipement : dernière et prochaine vérification, jours restants,
 * statut (`ok`, `soon` sous 30 jours, `late` en retard).
 */
export function equipmentCheck(kind, key, today = new Date()) {
  const def = EQUIPMENT_KINDS[kind];
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  // Ancienneté de la dernière vérification : de 0 à 125 % de la périodicité (environ 1 sur 5 en retard)
  const elapsed = Math.round(hash01(key) * def.periodDays * 1.25);
  const lastCheck = new Date(day - elapsed * DAY);
  const nextCheck = new Date(lastCheck.getTime() + def.periodDays * DAY);
  const daysLeft = Math.round((nextCheck.getTime() - day) / DAY);
  return {
    kind,
    label: def.label,
    check: def.check,
    lastLabel: def.lastLabel,
    nextLabel: def.nextLabel,
    model: def.models[Math.floor(hash01(key, 7) * def.models.length)],
    lastCheck,
    nextCheck,
    daysLeft,
    status: daysLeft < 0 ? 'late' : daysLeft <= SOON_DAYS ? 'soon' : 'ok',
    demo: true,
  };
}

export function formatDate(date) {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
