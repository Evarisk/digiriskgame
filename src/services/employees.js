/**
 * Salariés de l'entité (comptes Dolibarr, voir digiriskApi) placés sur le site : chacun est rattaché à
 * l'unité de travail qui correspond le mieux à son poste (mots du poste comparés au libellé de l'UT et
 * de son groupement, avec quelques équivalences métier), sinon réparti entre les UT. Les opérateurs
 * animés sont choisis parmi eux : chacun fait l'aller-retour entre son poste et une UT d'un autre bâtiment.
 */

const MAX_WALKERS = 8;

// Mots trop génériques pour rapprocher un poste d'une UT
const STOP_WORDS = new Set(['respo', 'agent', 'chef', 'lead', 'adjoi', 'assis', 'charg', 'senio', 'junio', 'ateli']);

// Équivalences métier (radicaux de 5 lettres au plus, sans accents)
const JOB_HINTS = {
  chari: ['caris', 'logis', 'stock', 'quais', 'exped'],
  caris: ['chari', 'logis', 'stock'],
  condu: ['caris', 'chari', 'trans'],
  entre: ['maint', 'netto'],
  maint: ['entre', 'mecan'],
  infor: ['resea', 'serve', 'suppo'],
  cto: ['infor', 'resea', 'serve'],
  devel: ['infor', 'resea'],
  daf: ['admin', 'finan', 'compt'],
  compt: ['finan', 'admin'],
  drh: ['resso', 'humai', 'admin'],
  rrh: ['resso', 'humai', 'admin'],
  pdg: ['direc', 'admin'],
  geran: ['direc', 'admin'],
  fonda: ['direc'],
  direc: ['admin'],
  qhse: ['quali', 'labor', 'secur'],
  quali: ['labor', 'contr'],
  comme: ['vente', 'vrp', 'salon', 'clien'],
  tourn: ['usina', 'frais', 'cnc'],
  frais: ['usina', 'tourn', 'cnc'],
  peint: ['pisto', 'cabin'],
  labor: ['analy', 'quali'],
  pilot: ['fret', 'aerie'],
  livre: ['cours', 'exped', 'quais'],
};

const stemsOf = (text) =>
  (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
    .map((w) => w.slice(0, 5));

/** Radicaux d'un poste, enrichis des équivalences métier. */
function jobStems(job) {
  const stems = stemsOf(job).filter((s) => !STOP_WORDS.has(s));
  return new Set([...stems, ...stems.flatMap((s) => JOB_HINTS[s] || [])]);
}

const hash = (n) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Rattache chaque salarié à une UT : `{ employee, ut, building, score }` (score 0 : poste sans UT
 * correspondante, réparti entre les UT dans l'ordre des identifiants).
 */
export function assignEmployees(employees, buildings) {
  const units = buildings.flatMap((b) =>
    (b.workUnits || []).map((ut) => ({ ut, building: b, own: new Set(stemsOf(ut.label)), context: new Set(stemsOf(`${ut.parentBuildingLabel} ${b.label}`)) }))
  );
  if (!units.length) return [];
  let next = 0;
  return [...employees]
    .sort((a, b) => a.id - b.id)
    .map((employee) => {
      const wanted = jobStems(employee.job);
      let best = null;
      let bestScore = 0;
      units.forEach((u, i) => {
        let score = 0;
        wanted.forEach((s) => {
          if (u.own.has(s)) score += 2;
          else if (u.context.has(s)) score += 1;
        });
        // À score égal, répartition stable entre les UT équivalentes
        const tieBreak = hash(employee.id * 31 + i) * 0.5;
        if (score > 0 && score + tieBreak > bestScore) {
          bestScore = score + tieBreak;
          best = u;
        }
      });
      const chosen = best || units[next++ % units.length];
      return { employee, ut: chosen.ut, building: chosen.building, score: Math.floor(bestScore) };
    });
}

/**
 * Opérateurs animés : salariés dont le poste correspond à une UT d'abord, puis les autres, au plus
 * MAX_WALKERS. Chacun relie son UT à une UT d'un autre bâtiment (du même s'il n'y en a qu'un).
 * Sans salariés lisibles, des opérateurs anonymes relient des UT de bâtiments différents.
 */
export function planWalkers(employees, buildings) {
  const staffed = buildings.filter((b) => b.workUnits?.length);
  const allUnits = staffed.flatMap((b) => b.workUnits);
  if (allUnits.length < 2) return [];

  const destination = (fromUt, fromBuilding, seed) => {
    const others = staffed.filter((b) => b !== fromBuilding);
    const pool = others.length ? others[Math.floor(hash(seed) * others.length)].workUnits : fromBuilding.workUnits.filter((u) => u !== fromUt);
    return pool[Math.floor(hash(seed + 7) * pool.length)] || allUnits.find((u) => u !== fromUt);
  };

  if (employees?.length) {
    const assigned = assignEmployees(employees, staffed);
    return assigned
      .sort((a, b) => b.score - a.score || a.employee.id - b.employee.id)
      .slice(0, MAX_WALKERS)
      .map(({ employee, ut, building }) => ({
        id: `employee-${employee.id}`,
        name: employee.name,
        job: employee.job,
        fromUt: ut,
        toUt: destination(ut, building, employee.id),
      }));
  }

  return Array.from({ length: Math.min(5, MAX_WALKERS) }, (_, i) => {
    const building = staffed[(i * 2) % staffed.length];
    const fromUt = building.workUnits[(i * 3) % building.workUnits.length];
    return { id: `operator-${i}`, name: 'Opérateur', job: '', fromUt, toUt: destination(fromUt, building, i + 1) };
  });
}
