#!/usr/bin/env node
/**
 * Tests de Cité Prévention avec des personas (sans navigateur) : chaque robot joue des parties complètes avec les
 * seules commandes du joueur ; on mesure résultats, indicateurs, rythme et charge de décision, puis on vérifie
 * les objectifs d'intérêt de jeu par public.
 *
 *   node scripts/simulate-aoe.mjs                 6 personas × 20 graines, tableau de synthèse
 *   node scripts/simulate-aoe.mjs --seeds 40      plus de graines
 *   node scripts/simulate-aoe.mjs --only karim    une seule persona
 *   node scripts/simulate-aoe.mjs --json out.json résultats détaillés
 *   node scripts/simulate-aoe.mjs --check         code de sortie 1 si un objectif n'est pas atteint
 */
import { writeFileSync } from 'node:fs';
import { createGame, step, kpis, scoreOf, population, YEAR } from '../src/game/aoe/engine.js';
import { PERSONAS, botTick } from '../src/game/aoe/personas.js';
import { MONTH } from '../src/game/aoe/config.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const SEEDS = Number(opt('seeds', 20));
const ONLY = opt('only', null);
const JSON_OUT = opt('json', null);
const CHECK = args.includes('--check');
const DT = 0.25;

function play(personaId, seed) {
  const s = createGame({ seed });
  const memo = {};
  let firstAccident = null;
  let peakPop = 0;
  let decisions = 0;
  let refused = 0;
  const timeline = [];
  const t0 = Date.now();
  while (!s.outcome && s.time < YEAR + 1) {
    const res = botTick(s, personaId, memo);
    decisions += res.length;
    refused += res.filter((r) => !r.r.ok).length;
    step(s, DT);
    if (firstAccident === null && s.kpi.accidents > 0) firstAccident = s.time;
    peakPop = Math.max(peakPop, population(s).pop);
    if (Math.abs(s.time % MONTH) < DT / 2) timeline.push({ month: Math.round(s.time / MONTH), score: scoreOf(s).total, accidents: s.kpi.accidents, age: s.age });
  }
  const k = kpis(s);
  const sc = s.outcome?.score || scoreOf(s);
  return {
    persona: personaId,
    seed,
    result: s.outcome?.result || 'yearEnd',
    reason: s.outcome?.reason,
    minutes: s.time / 60,
    score: sc.total,
    stars: sc.stars,
    parts: sc.parts,
    du: k.du.ratio,
    duDone: k.du.done,
    utTotal: k.du.total,
    sens: k.sensibilises.ratio,
    accidents: k.accidents,
    registres: k.registres,
    ageAt: s.stats.ageAt,
    age: s.age,
    firstAccident,
    idle: s.stats.agentSeconds ? s.stats.idleAgentSeconds / s.stats.agentSeconds : 0,
    apm: decisions / (s.time / 60),
    refusedRatio: decisions ? refused / decisions : 0,
    peakPop,
    hazards: s.stats.hazards,
    nearMiss: s.stats.firstNearMiss ?? null,
    inspection: s.stats.inspection,
    gathered: s.stats.gathered,
    prevShort: s.stats.prevShort, // secondes de travail de préventeur en attente de temps préventeur
    preventeurs: s.units.filter((u) => u.type === 'preventeur').length,
    timeline,
    ms: Date.now() - t0,
  };
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const pct = (v) => `${Math.round(v * 100)} %`;
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '–');

const personas = PERSONAS.filter((p) => !ONLY || p.id === ONLY);
const all = {};
for (const p of personas) {
  all[p.id] = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) all[p.id].push(play(p.id, seed));
}

function summary(runs) {
  const wins = runs.filter((r) => r.result === 'victory');
  const defeats = runs.filter((r) => r.result === 'defeat');
  return {
    n: runs.length,
    victory: wins.length / runs.length,
    defeat: defeats.length / runs.length,
    score: avg(runs.map((r) => r.score)),
    star1: runs.filter((r) => r.stars >= 1).length / runs.length,
    star3: runs.filter((r) => r.stars >= 3).length / runs.length,
    winMinutes: avg(wins.map((r) => r.minutes)),
    age2: avg(runs.filter((r) => r.ageAt[2]).map((r) => r.ageAt[2] / 60)),
    age3: avg(runs.filter((r) => r.ageAt[3]).map((r) => r.ageAt[3] / 60)),
    duDone: runs.filter((r) => r.duDone).length / runs.length,
    sens: avg(runs.map((r) => r.sens)),
    accidents: avg(runs.map((r) => r.accidents)),
    registres: avg(runs.map((r) => r.registres)),
    firstAccident: avg(runs.filter((r) => r.firstAccident !== null).map((r) => r.firstAccident / 60)),
    idle: avg(runs.map((r) => r.idle)),
    apm: avg(runs.map((r) => r.apm)),
    refused: avg(runs.map((r) => r.refusedRatio)),
    inspectionOk: runs.filter((r) => r.inspection === 'ok').length / Math.max(1, runs.filter((r) => r.inspection).length),
    ms: avg(runs.map((r) => r.ms)),
  };
}

const S = {};
console.log(`Cité Prévention — ${SEEDS} parties par persona (×1 = 12 min par année)\n`);
console.log('persona   victoire défaite  score  ≥1★   3★  min.vict  pal.2  pal.3  DU fait  sensib.  accid.  regist.  1er acc.  inoccupés  décisions/min  refus');
for (const p of personas) {
  const m = (S[p.id] = summary(all[p.id]));
  console.log(
    `${p.id.padEnd(9)} ${pct(m.victory).padStart(7)} ${pct(m.defeat).padStart(7)} ${String(Math.round(m.score)).padStart(6)} ${pct(m.star1).padStart(5)} ${pct(m.star3).padStart(5)} ${f1(m.winMinutes).padStart(8)} ${f1(m.age2).padStart(6)} ${f1(m.age3).padStart(6)} ${pct(m.duDone).padStart(8)} ${pct(m.sens).padStart(8)} ${f1(m.accidents).padStart(7)} ${f1(m.registres).padStart(8)} ${f1(m.firstAccident).padStart(9)} ${pct(m.idle).padStart(10)} ${f1(m.apm).padStart(14)} ${pct(m.refused).padStart(6)}`
  );
}
console.log(`\n(temps de calcul moyen d'une partie : ${Math.round(avg(Object.values(S).map((m) => m.ms)))} ms)`);

/* Objectifs d'intérêt de jeu par persona (voir docs/jeu-aoe/personas.md) */
const goals = [];
const goal = (id, label, ok, detail) => S[id] && goals.push({ id, label, ok, detail });
if (S.claire) {
  goal('claire', 'débutante : au moins une étoile dans 70 % des parties', S.claire.star1 >= 0.7, pct(S.claire.star1));
  goal('claire', 'débutante : défaite dans 15 % des parties au plus', S.claire.defeat <= 0.15, pct(S.claire.defeat));
  // L'enjeu doit être vécu tôt (boucle danger → préventeur) ; le taux d'accidents est rapporté, pas exigé : bien
  // guidée, la débutante est protégée, c'est la leçon du jeu
  const met = avg(all.claire.map((r) => r.hazards.spawned));
  const early = all.claire.filter((r) => r.nearMiss !== null && r.nearMiss <= 180).length / all.claire.length;
  const withAccident = all.claire.filter((r) => r.accidents > 0).length / all.claire.length;
  goal('claire', 'débutante : l’enjeu est visible (presqu’accident vécu dans les 3 premières minutes, ≥ 8 dangers croisés)', early >= 0.95 && met >= 8, `presqu’accident tôt dans ${pct(early)} des parties, ${f1(met)} dangers, accident dans ${pct(withAccident)} des parties`);
}
if (S.karim) {
  goal('karim', 'expert prévention : victoire dans 60 % des parties', S.karim.victory >= 0.6, pct(S.karim.victory));
  goal('karim', 'expert prévention : score moyen ≥ 750', S.karim.score >= 750, Math.round(S.karim.score));
  goal('karim', 'expert prévention : DU fait avant l’inspection (≥ 80 %)', S.karim.inspectionOk >= 0.8, pct(S.karim.inspectionOk));
}
if (S.sophie) {
  goal('sophie', 'gestionnaire : victoire dans 40 % des parties', S.sophie.victory >= 0.4, pct(S.sophie.victory));
  goal('sophie', 'gestionnaire : score moyen ≥ 600', S.sophie.score >= 600, Math.round(S.sophie.score));
}
if (S.lucas) {
  goal('lucas', 'joueur confirmé : victoire dans 80 % des parties', S.lucas.victory >= 0.8, pct(S.lucas.victory));
  goal('lucas', 'joueur confirmé : pas de victoire éclair (≥ 6 min en moyenne)', !(S.lucas.winMinutes < 6), f1(S.lucas.winMinutes));
  goal('lucas', 'joueur confirmé : partie encore ouverte (victoire ≤ 11 min en moyenne)', S.lucas.winMinutes <= 11, f1(S.lucas.winMinutes));
}
if (S.marc) {
  goal('marc', 'sans prévention : jamais de victoire', S.marc.victory === 0, pct(S.marc.victory));
  goal('marc', 'sans prévention : défaite ou moins d’une étoile dans 90 % des parties', all.marc.filter((r) => r.result === 'defeat' || r.stars === 0).length / all.marc.length >= 0.9, pct(all.marc.filter((r) => r.result === 'defeat' || r.stars === 0).length / all.marc.length));
  goal('marc', 'sans prévention : au moins 2× plus d’accidents que l’expert', !S.karim || S.marc.accidents >= 2 * S.karim.accidents, `${f1(S.marc.accidents)} contre ${S.karim ? f1(S.karim.accidents) : '–'}`);
}
if (S.demo) {
  goal('demo', 'démo du stand : victoire dans 80 % des parties', S.demo.victory >= 0.8, pct(S.demo.victory));
  const shown = avg(all.demo.map((r) => r.hazards.revealed));
  const neutralized = avg(all.demo.map((r) => r.hazards.neutralized));
  goal('demo', 'démo du stand : montre des dangers repérés et neutralisés (≥ 5 de chaque) et 12 registres', shown >= 5 && neutralized >= 5 && S.demo.registres >= 12, `${f1(shown)} repérés, ${f1(neutralized)} neutralisés, ${f1(S.demo.registres)} registres, ${f1(S.demo.accidents)} accidents`);
  goal('demo', 'démo du stand : tient en 12 minutes', S.demo.winMinutes <= 12, f1(S.demo.winMinutes));
}
if (S.karim && S.claire && S.lucas) goal('karim', 'progression de maîtrise : débutante < expert prévention ≤ joueur confirmé (score)', S.claire.score < S.karim.score && S.karim.score <= S.lucas.score + 60, `${Math.round(S.claire.score)} < ${Math.round(S.karim.score)} ≤ ${Math.round(S.lucas.score)} (+60)`);

console.log('\nObjectifs d’intérêt de jeu');
goals.forEach((g) => console.log(`${g.ok ? 'OK ' : 'NON'}  ${g.label} — ${g.detail}`));
const failed = goals.filter((g) => !g.ok).length;
console.log(failed ? `\n${failed} objectif(s) non atteint(s)` : '\nTous les objectifs sont atteints');
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify({ seeds: SEEDS, summary: S, goals, runs: all }, null, 1));
if (CHECK && failed) process.exit(1);
