import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Hourglass,
  Euro,
  ClipboardList,
  Users,
  Pause,
  Play,
  ShieldCheck,
  GraduationCap,
  TriangleAlert,
  FileCheck,
  Home,
  Store,
  Warehouse,
  Sprout,
  Trees,
  Star,
  RotateCcw,
  ArrowLeft,
  Bot,
  Hand,
  Lightbulb,
  X,
  Check,
  Clock,
  Landmark,
  Soup,
  Stethoscope,
  Wrench,
  Signpost,
  UserPlus,
  HardHat,
  CircleStop,
  Flag,
  CircleHelp,
} from 'lucide-react';
import { BUILDINGS, UNITS, TECHS, AGES, MONTH, YEAR_MONTHS, NODES, RESOURCES, MAP_HALF, ACCIDENT, SCORE, TRAIN, PREV_TIME, EVAL_TIME, jours } from '../../game/aoe/config.js';
import { kpis, population, ageStatus, nextHint, scoreOf, yearTime, prevTimeCap, FOG_N, visibleAt, exploredAt } from '../../game/aoe/engine.js';
import { store, useAoe, command, setUi, lookAt, newGame, backToStart, emit } from './aoeStore';
import { startPlacing, clearSelection } from './aoeOrders';
import { STEPS, tutoStep, tutorialDone } from './aoeTutorial';
import { TutorialCard, FocusRing, HelpPanel, openHelp, closeHelp } from './AoeGuide';

const RES_ICON = { heures: Hourglass, budget: Euro, temps: ShieldCheck, remontees: ClipboardList };
const RES_HELP = {
  heures: 'Heures d’équipe : le travail des agents sur les sites (bosquets, jardin, potagers), pointé au dépôt. Sert à construire et à recruter.',
  budget: 'Budget : chantiers de voirie (subventions des travaux), impôts locaux, commerces. Sert aux formations, aux améliorations et aux préventeurs.',
  temps: `Temps préventeur : chaque évaluation ou neutralisation en consomme (environ ${Math.round(PREV_TIME.use * EVAL_TIME)} h pour évaluer une UT). La réserve se recharge et grandit avec chaque préventeur.`,
  remontees: 'Remontées : les idées d’amélioration des agents sensibilisés, pour les améliorations de prévention.',
};
const BUILD_ICON = { mairie: Landmark, maison: Home, depot: Trees, cantine: Soup, potager: Sprout, formation: GraduationCap, prevention: ShieldCheck, atelier: Wrench, infirmerie: Stethoscope, commerce: Store, point: Signpost, entrepot: Warehouse };
const fmt = (v) => Math.floor(v).toLocaleString('fr-FR');
const costText = (cost = {}) =>
  Object.entries(cost)
    .map(([r, v]) => `${v} ${RESOURCES[r].unit}`)
    .join(' · ');
const canPay = (cost = {}) => Object.entries(cost).every(([r, v]) => store.game.res[r] >= v);

/* ------------------------------------------------------------------ */
/* Barre du haut                                                        */
/* ------------------------------------------------------------------ */

function TopBar() {
  const g = store.game;
  const { pop, cap } = population(g);
  const year = yearTime(g);
  const month = Math.min(YEAR_MONTHS, Math.floor(year / MONTH) + 1);
  const ui = store.ui;
  return (
    <header className="aoe-top">
      <div className="aoe-brand">
        <a href="./" title="Retour au jumeau numérique" className="aoe-back">
          <ArrowLeft size={16} />
        </a>
        <div>
          <strong>Cité Prévention</strong>
          <span>Jeu de stratégie DigiRisk</span>
        </div>
      </div>
      <div className="aoe-res" data-tuto="res">
        {['heures', 'budget', 'temps', 'remontees'].map((r) => {
          const Icon = RES_ICON[r];
          const low = r === 'temps' && g.res.temps < PREV_TIME.use * 4;
          return (
            <span key={r} className={`aoe-chip res-${r} ${low ? 'warn' : ''}`} title={RES_HELP[r]}>
              <Icon size={15} />
              {fmt(g.res[r])}
              {r === 'temps' ? ` / ${prevTimeCap(g)} h` : r === 'heures' ? ' h' : r === 'budget' ? ' €' : ''}
              <em>{{ heures: 'd’équipe', budget: '', temps: 'préventeur', remontees: 'remontées' }[r]}</em>
            </span>
          );
        })}
        <span className={`aoe-chip ${pop >= cap ? 'warn' : ''}`} title="Population / logements">
          <Users size={15} />
          {pop} / {cap}
        </span>
      </div>
      <div className="aoe-age" title={AGES[g.age - 1].hint}>
        <Flag size={15} />
        Palier {g.age} · {AGES[g.age - 1].name}
      </div>
      <div className="aoe-clock" title={g.calm ? 'Calendrier arrêté pendant le didacticiel' : 'Une année de jeu : 12 mois d’une minute'}>
        <Clock size={15} />
        Mois {month} / {YEAR_MONTHS}
        <i style={{ width: `${Math.min(100, (year / (MONTH * YEAR_MONTHS)) * 100)}%` }} />
      </div>
      <div className="aoe-speed">
        <button type="button" className="aoe-help-btn" onClick={openHelp} title="Comment jouer">
          <CircleHelp size={16} />
        </button>
        <button type="button" className={ui.paused ? 'on' : ''} onClick={() => setUi({ paused: !ui.paused })} title="Pause (Espace)">
          {ui.paused ? <Play size={15} /> : <Pause size={15} />}
        </button>
        {[1, 2, 4].map((s) => (
          <button key={s} type="button" className={!ui.paused && ui.speed === s ? 'on' : ''} onClick={() => setUi({ speed: s, paused: false })} title={`Vitesse ×${s} (${s === 4 ? 3 : s})`}>
            ×{s}
          </button>
        ))}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Indicateurs                                                          */
/* ------------------------------------------------------------------ */

function KpiPanel() {
  const g = store.game;
  const k = kpis(g);
  const st = ageStatus(g);
  const calm = Math.max(0, Math.round(g.time - g.kpi.lastAccident));
  const cards = [
    {
      key: 'du',
      icon: FileCheck,
      title: 'Document unique',
      value: `${k.du.evaluated} / ${k.du.total} UT`,
      status: k.du.done ? 'Fait' : 'À compléter',
      ok: k.du.done,
      ratio: k.du.ratio,
      help: 'Chaque unité de travail en activité doit être évaluée par un préventeur (pastille « DU ? » au-dessus).',
    },
    {
      key: 'sens',
      icon: GraduationCap,
      title: 'Salariés sensibilisés',
      value: `${k.sensibilises.n} / ${k.sensibilises.total}`,
      status: `${Math.round(k.sensibilises.ratio * 100)} %`,
      ok: k.sensibilises.ratio >= 0.8,
      ratio: k.sensibilises.ratio,
      help: 'Passage en salle de formation : un agent sensibilisé porte ses protections, a deux à trois fois moins d’accidents et signale les dangers.',
    },
    {
      key: 'acc',
      icon: TriangleAlert,
      title: 'Accidents sur les sites',
      value: `${k.accidents}`,
      status: k.accidents ? `${jours(calm)} sans accident` : 'Aucun',
      ok: k.accidents === 0,
      danger: k.accidents >= ACCIDENT.defeatAt - 3,
      ratio: 1 - Math.min(1, k.accidents / ACCIDENT.defeatAt),
      help: `Un danger non traité près d’un agent peut le blesser. À ${ACCIDENT.defeatAt} accidents, l’inspection du travail suspend l’activité (défaite).`,
    },
    {
      key: 'reg',
      icon: ClipboardList,
      title: 'Registres remontés',
      value: `${k.registres} / ${SCORE.registresTarget}`,
      status: k.registres >= SCORE.registresTarget ? 'Objectif atteint' : 'Signalements',
      ok: k.registres >= SCORE.registresTarget,
      ratio: Math.min(1, k.registres / SCORE.registresTarget),
      help: 'Les agents sensibilisés signalent dangers et améliorations ; les fiches arrivent au registre au retour au dépôt (ou tout de suite avec l’application DigiRisk).',
    },
  ];
  return (
    <aside className="aoe-kpis" data-tuto="kpis">
      <h2>Indicateurs de prévention</h2>
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.key} className={`aoe-kpi ${c.ok ? 'ok' : ''} ${c.danger ? 'danger' : ''}`} title={c.help} data-tuto={`kpi-${c.key}`}>
            <Icon size={18} />
            <div>
              <span>{c.title}</span>
              <strong>{c.value}</strong>
              <em>{c.status}</em>
              <i>
                <b style={{ width: `${Math.round(c.ratio * 100)}%` }} />
              </i>
            </div>
          </div>
        );
      })}
      {st.next && (
        <div className="aoe-next-age" data-tuto="next-age">
          <h3>
            Palier {st.next.id} · {st.next.name}
          </h3>
          <p>{st.next.hint}</p>
          {st.missing.length ? (
            <ul>
              {st.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <p className="ok">{st.upgrading ? 'Passage en cours à l’hôtel de ville…' : 'Conditions réunies : franchissez-le à l’hôtel de ville.'}</p>
          )}
        </div>
      )}
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Prochaine étape, notifications                                       */
/* ------------------------------------------------------------------ */

function HintPanel() {
  const g = store.game;
  const h = nextHint(g);
  const doIt = () => {
    if (h.action) command(h.action);
    else if (h.build) startPlacing(h.build);
  };
  return (
    <div className="aoe-hint" data-tuto="hint">
      <h3>
        <Lightbulb size={15} /> Prochaine étape
      </h3>
      <p>{h.text}</p>
      {(h.action || h.build) && (
        <button type="button" onClick={doIt}>
          {h.build ? 'Choisir l’emplacement' : 'Faire'}
        </button>
      )}
    </div>
  );
}

function Notes() {
  const now = performance.now();
  return (
    <div className="aoe-notes">
      {store.ui.notes
        .filter((n) => now - n.at < 14000)
        .map((n) => (
          <button key={n.id} type="button" className={`aoe-note ${n.level}`} onClick={() => n.pos && lookAt(n.pos[0], n.pos[1])}>
            {n.text}
          </button>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sélection                                                            */
/* ------------------------------------------------------------------ */

function taskLabel(u, g) {
  if (u.injured) return `blessé, reprise dans ${jours(u.injured)}`;
  const t = u.task;
  if (!t) return 'inoccupé';
  if (t.kind === 'gather') {
    const n = g.nodes.find((x) => x.id === t.target.id);
    const where = !n ? 'au potager' : n.kind === 'arbre' ? 'à l’élagage' : n.kind === 'jardin' ? 'au jardin' : 'sur le chantier de voirie';
    if (t.phase === 'return') return n?.kind === 'chantier' ? 'rapporte la subvention' : 'va pointer ses heures';
    return `travaille ${where}`;
  }
  if (t.kind === 'build') return 'construit';
  if (t.kind === 'train') return 'va se former';
  if (t.kind === 'training') return 'en formation';
  if (u.short && (t.kind === 'evaluate' || t.kind === 'neutralize')) return 'attend du temps préventeur';
  if (t.kind === 'evaluate') return `évalue « ${g.uts[t.utId]?.name} »`;
  if (t.kind === 'neutralize') return 'neutralise un danger';
  if (t.kind === 'move') return 'se déplace';
  return t.kind;
}

function BuildMenu() {
  const g = store.game;
  return (
    <div className="aoe-grid">
      {Object.entries(BUILDINGS)
        .filter(([, d]) => d.buildable !== false)
        .map(([kind, d]) => {
          const Icon = BUILD_ICON[kind] || Home;
          const locked = d.age > g.age;
          return (
            <button key={kind} type="button" data-tuto={`build-${kind}`} disabled={locked || !canPay(d.cost)} onClick={() => startPlacing(kind)} title={`${d.label} — ${costText(d.cost)}\n${d.hint}${locked ? `\nDisponible au palier ${d.age} (${AGES[d.age - 1].name})` : ''}`}>
              <Icon size={18} />
              <span>{d.label}</span>
              <em>{locked ? `palier ${d.age}` : costText(d.cost)}</em>
            </button>
          );
        })}
    </div>
  );
}

function UnitPanel({ units }) {
  const g = store.game;
  const agents = units.filter((u) => u.type === 'agent');
  const prev = units.filter((u) => u.type === 'preventeur');
  const formation = g.buildings.filter((b) => b.kind === 'formation' && b.done).sort((a, b) => Math.hypot(a.x - units[0].x, a.z - units[0].z) - Math.hypot(b.x - units[0].x, b.z - units[0].z))[0];
  const pending = Object.values(g.uts).filter((u) => (u.active || (u.kind === 'building' && g.buildings.some((b) => b.id === u.refId && !b.done))) && !u.evaluated);
  const flagged = g.hazards.filter((h) => h.revealed);
  const one = units.length === 1 ? units[0] : null;
  const counts = Object.entries(units.reduce((acc, u) => ({ ...acc, [u.type]: (acc[u.type] || 0) + 1 }), {}));
  return (
    <>
      <div className="aoe-sel-head">
        <HardHat size={18} />
        <div>
          <strong>{one ? `${one.name} — ${UNITS[one.type].label}` : counts.map(([t, n]) => `${n} ${UNITS[t].label.toLowerCase()}${n > 1 ? 's' : ''}`).join(' · ')}</strong>
          <span>
            {one
              ? `${one.type === 'preventeur' ? `Temps préventeur : ${Math.floor(g.res.temps)} h` : one.sens ? 'Sensibilisé' : 'Non sensibilisé'} · ${taskLabel(one, g)}${one.carry?.amount > 0.5 ? ` · ${Math.floor(one.carry.amount)} ${one.carry.res === 'budget' ? '€' : 'h'} à pointer` : ''}${one.reports?.length ? ` · ${one.reports.length} fiche(s) à remonter` : ''}`
              : `${units.filter((u) => u.sens).length} sensibilisé(s) sur ${units.length}`}
          </span>
        </div>
      </div>
      <div className="aoe-actions">
        {agents.length > 0 && formation && agents.some((u) => !u.sens) && (
          <button type="button" onClick={() => command({ type: 'train', unitIds: agents.map((u) => u.id), buildingId: formation.id })} title={`${TRAIN.cost.budget} € et ${jours(TRAIN.time)} par agent`}>
            <GraduationCap size={15} /> Former ({agents.filter((u) => !u.sens).length})
          </button>
        )}
        {prev.length > 0 &&
          pending.slice(0, 4).map((ut, i) => (
            <button key={ut.id} type="button" data-tuto={i === 0 ? 'evaluate' : undefined} onClick={() => command({ type: 'evaluate', unitIds: prev.map((u) => u.id), utId: ut.id })} title={`Évaluer cette unité de travail (document unique) : ${jours(g.techs.methode ? EVAL_TIME / 2 : EVAL_TIME)} sur place, environ ${Math.round(PREV_TIME.use * (g.techs.methode ? EVAL_TIME / 2 : EVAL_TIME))} h de temps préventeur`}>
              <FileCheck size={15} /> Évaluer « {ut.name} »
            </button>
          ))}
        {prev.length > 0 && flagged.length > 0 && (
          <button
            type="button"
            className="danger"
            data-tuto="neutralize"
            onClick={() => {
              const h = [...flagged].sort((a, b) => Math.hypot(a.x - prev[0].x, a.z - prev[0].z) - Math.hypot(b.x - prev[0].x, b.z - prev[0].z))[0];
              command({ type: 'neutralize', unitIds: prev.map((u) => u.id), hazardId: h.id });
            }}
          >
            <TriangleAlert size={15} /> Neutraliser le danger le plus proche
          </button>
        )}
        <button type="button" onClick={() => command({ type: 'stop', unitIds: units.map((u) => u.id) })}>
          <CircleStop size={15} /> Arrêter
        </button>
      </div>
      {agents.length > 0 && (
        <>
          <h4>Construire (clic, puis emplacement ; R pour pivoter)</h4>
          <BuildMenu />
        </>
      )}
      {!agents.length && prev.length > 0 && <p className="aoe-tip">Clic droit sur un bâtiment ou un site : évaluer son unité de travail. Clic droit sur un danger : le neutraliser. Chaque intervention consomme du temps préventeur (en haut), qui se recharge.</p>}
    </>
  );
}

function QueueRow({ b }) {
  return (
    <div className="aoe-queue">
      {b.queue.map((q, i) => (
        <span key={`${q.kind}${q.id}${i}`} title="Annuler">
          {q.kind === 'unit' ? UNITS[q.id].label : q.kind === 'tech' ? TECHS[q.id].label : `Palier ${q.id}`}
          {i === 0 && <i style={{ width: `${Math.round((1 - q.left / q.total) * 100)}%` }} />}
          <button type="button" onClick={() => command({ type: 'cancel', buildingId: b.id, index: i })}>
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}

function BuildingPanel({ b }) {
  const g = store.game;
  const def = BUILDINGS[b.kind];
  const Icon = BUILD_ICON[b.kind] || Home;
  const ut = b.utId ? g.uts[b.utId] : def.field ? g.uts.jardins : null;
  const st = ageStatus(g);
  return (
    <>
      <div className="aoe-sel-head">
        <Icon size={18} />
        <div>
          <strong>{def.label}</strong>
          <span>
            {b.done ? def.hint : `Chantier : ${Math.round(b.progress * 100)} % — clic droit avec des agents pour aider`}
            {ut ? ` · UT « ${ut.name} » ${ut.evaluated ? 'évaluée' : 'à évaluer'}` : ''}
            {def.field && b.done ? ` · reste ${Math.floor(b.fieldLeft)} h de travail` : ''}
            {b.kind === 'formation' ? ` · ${b.garrison.length} en formation` : ''}
          </span>
        </div>
      </div>
      {b.done && (
        <div className="aoe-actions">
          {(def.trains || []).map((id) => {
            const u = UNITS[id];
            const locked = (u.age || 1) > g.age;
            return (
              <button key={id} type="button" data-tuto={`unit-${id}`} disabled={locked || !canPay(u.cost)} onClick={() => command({ type: 'queue', buildingId: b.id, item: { kind: 'unit', id } })} title={`${u.label} — ${costText(u.cost)}, ${jours(u.time)}${id === 'preventeur' ? ` ; +${PREV_TIME.cap} h de réserve de temps préventeur` : ''}`}>
                <UserPlus size={15} /> {u.label} <em>{locked ? `palier ${u.age}` : costText(u.cost)}</em>
              </button>
            );
          })}
          {(def.techs || []).map((id) => {
            const t = TECHS[id];
            const done = g.techs[id];
            const queued = g.buildings.some((x) => x.queue.some((q) => q.kind === 'tech' && q.id === id));
            const locked = t.age > g.age;
            return (
              <button key={id} type="button" className={done ? 'done' : ''} disabled={done || queued || locked || !canPay(t.cost)} onClick={() => command({ type: 'queue', buildingId: b.id, item: { kind: 'tech', id } })} title={`${t.label} — ${t.hint}\n${costText(t.cost)}, ${jours(t.time)}`}>
                {done ? <Check size={15} /> : <Lightbulb size={15} />} {t.label} <em>{done ? 'acquise' : locked ? `palier ${t.age}` : costText(t.cost)}</em>
              </button>
            );
          })}
          {b.kind === 'mairie' && st.next && (
            <button type="button" className="age" disabled={!st.ok} onClick={() => command({ type: 'queue', buildingId: b.id, item: { kind: 'age' } })} title={st.missing.join('\n') || st.next.hint}>
              <Flag size={15} /> Palier {st.next.id} « {st.next.name} » <em>{costText(st.next.cost)}</em>
            </button>
          )}
        </div>
      )}
      {b.queue.length > 0 && <QueueRow b={b} />}
    </>
  );
}

function SelectionPanel() {
  const g = store.game;
  const sel = store.ui.selection;
  const units = sel.map((id) => g.units.find((u) => u.id === id)).filter(Boolean);
  const b = sel.length === 1 && g.buildings.find((x) => x.id === sel[0]);
  const n = sel.length === 1 && g.nodes.find((x) => x.id === sel[0]);
  const h = sel.length === 1 && g.hazards.find((x) => x.id === sel[0]);
  let body;
  if (units.length) body = <UnitPanel units={units} />;
  else if (b) body = <BuildingPanel b={b} />;
  else if (n) {
    const def = NODES[n.kind];
    const ut = g.uts[n.utId];
    body = (
      <div className="aoe-sel-head">
        {n.kind === 'arbre' ? <Trees size={18} /> : n.kind === 'jardin' ? <Sprout size={18} /> : <Wrench size={18} />}
        <div>
          <strong>{def.label}</strong>
          <span>
            Reste {Math.floor(n.amount)} {def.resource === 'budget' ? '€ de subventions' : 'h de travail'} · UT « {ut?.name} » {ut?.evaluated ? 'évaluée' : 'à évaluer'} · clic droit avec des agents pour les y faire travailler
          </span>
        </div>
      </div>
    );
  } else if (h) {
    const prev = g.units.find((u) => u.type === 'preventeur' && !u.hidden && !u.injured);
    body = (
      <>
        <div className="aoe-sel-head danger">
          <TriangleAlert size={18} />
          <div>
            <strong>Danger : {h.kind}</strong>
            <span>UT « {g.uts[h.utId]?.name} » · disparaît de lui-même s’il n’est pas traité, mais peut blesser un agent d’ici là</span>
          </div>
        </div>
        {prev && (
          <div className="aoe-actions">
            <button type="button" className="danger" data-tuto="neutralize" onClick={() => command({ type: 'neutralize', unitIds: [prev.id], hazardId: h.id })}>
              <ShieldCheck size={15} /> Envoyer {prev.name} le neutraliser
            </button>
          </div>
        )}
      </>
    );
  } else
    body = (
      <p className="aoe-tip">
        Clic gauche : sélectionner (glisser pour plusieurs agents, Maj pour ajouter) · clic droit : ordre (travailler sur un site, construire, se former, évaluer, neutraliser) · ZQSD / flèches : déplacer la vue · molette : zoom · H : préventeur · point : agents inoccupés · Espace : pause · bouton ? en haut : comment jouer
      </p>
    );
  return <section className="aoe-selection">{body}</section>;
}

/* ------------------------------------------------------------------ */
/* Minicarte, agents inoccupés                                          */
/* ------------------------------------------------------------------ */

function Minimap() {
  const ref = useRef();
  useEffect(() => {
    const draw = () => {
      const c = ref.current;
      const g = store.game;
      if (!c || !g) return;
      const ctx = c.getContext('2d');
      const S = c.width;
      const k = S / (MAP_HALF * 2);
      const P = (x, z) => [(x + MAP_HALF) * k, (z + MAP_HALF) * k];
      const cell = S / FOG_N;
      for (let fz = 0; fz < FOG_N; fz += 1) {
        for (let fx = 0; fx < FOG_N; fx += 1) {
          const i = fz * FOG_N + fx;
          ctx.fillStyle = g.explored[i] ? (g.visible[i] ? '#5c8a45' : '#3b5a30') : '#0b1016';
          ctx.fillRect(fx * cell, fz * cell, cell + 0.5, cell + 0.5);
        }
      }
      g.nodes.forEach((n) => {
        if (n.amount <= 0 || !exploredAt(g, n.x, n.z)) return;
        const [x, y] = P(n.x, n.z);
        ctx.fillStyle = n.kind === 'arbre' ? '#1f5f2a' : n.kind === 'chantier' ? '#f59e0b' : '#a3e635';
        ctx.fillRect(x - 1.5, y - 1.5, n.kind === 'arbre' ? 3 : 5, n.kind === 'arbre' ? 3 : 4);
      });
      g.buildings.forEach((b) => {
        const [x, y] = P(b.x, b.z);
        const [w, d] = BUILDINGS[b.kind].size;
        ctx.fillStyle = b.done ? '#93c5fd' : '#cbd5e1';
        ctx.fillRect(x - (w * k) / 2, y - (d * k) / 2, Math.max(3, w * k), Math.max(3, d * k));
      });
      g.hazards.forEach((h) => {
        if (!h.revealed) return;
        const [x, y] = P(h.x, h.z);
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      g.units.forEach((u) => {
        if (u.hidden) return;
        const [x, y] = P(u.x, u.z);
        ctx.fillStyle = u.type === 'preventeur' ? '#60a5fa' : u.sens ? '#fde047' : '#ffffff';
        ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
      });
      const cam = store.camera;
      const [cx, cy] = P(cam.x, cam.z);
      const vw = cam.d * 1.4 * k;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(cx - vw / 2, cy - vw * 0.32, vw, vw * 0.64);
    };
    draw();
    const timer = setInterval(draw, 400);
    return () => clearInterval(timer);
  }, []);
  const jump = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    lookAt(((e.clientX - r.left) / r.width) * MAP_HALF * 2 - MAP_HALF, ((e.clientY - r.top) / r.height) * MAP_HALF * 2 - MAP_HALF);
  };
  return <canvas ref={ref} className="aoe-minimap" width={180} height={180} onPointerDown={jump} title="Minicarte : cliquez pour y aller" />;
}

function IdleButton() {
  const g = store.game;
  const idle = g.units.filter((u) => u.type === 'agent' && !u.task && !u.hidden && !u.injured);
  if (!idle.length) return null;
  return (
    <button
      type="button"
      className="aoe-idle"
      data-tuto="idle"
      onClick={() => {
        store.ui.selection = idle.map((u) => u.id);
        lookAt(idle[0].x, idle[0].z);
        emit();
      }}
      title="Sélectionner les agents inoccupés (touche point)"
    >
      <Users size={15} /> {idle.length} inoccupé{idle.length > 1 ? 's' : ''}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Écrans d'accueil et de fin                                           */
/* ------------------------------------------------------------------ */

export function StartScreen() {
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const first = !tutorialDone();
  return (
    <div className="aoe-screen">
      <div className="aoe-card">
        <h1>Cité Prévention</h1>
        <p className="lead">Un jeu de stratégie en temps réel DigiRisk : développez votre commune, faites travailler vos agents… et tenez vos quatre indicateurs de prévention.</p>
        <div className="aoe-kpi-intro">
          <div>
            <FileCheck size={20} />
            <strong>Document unique fait ?</strong>
            <span>Votre préventeur évalue chaque unité de travail en activité : bâtiments, chantiers, espaces verts.</span>
          </div>
          <div>
            <GraduationCap size={20} />
            <strong>Salariés sensibilisés</strong>
            <span>La salle de formation équipe et forme vos agents : moins d’accidents, plus de signalements.</span>
          </div>
          <div>
            <TriangleAlert size={20} />
            <strong>Accidents sur les sites</strong>
            <span>Des dangers apparaissent là où l’on travaille. Repérés, neutralisés, ils ne blessent personne.</span>
          </div>
          <div>
            <ClipboardList size={20} />
            <strong>Registres remontés</strong>
            <span>Les agents sensibilisés signalent dangers et améliorations : chaque fiche fait baisser le risque.</span>
          </div>
        </div>
        <p>
          Faites travailler vos équipes (heures d’équipe), trouvez du budget, ménagez le temps de vos préventeurs, construisez les bâtiments de la mairie et franchissez les quatre paliers jusqu’à la <strong>culture de prévention</strong> en moins d’un an (12 minutes).
        </p>
        <div className="aoe-buttons">
          {!touch && (
            <button type="button" className={first ? 'primary' : ''} onClick={() => newGame({ tutorial: true })} title="Une vraie partie, guidée pas à pas">
              <GraduationCap size={16} /> Didacticiel (5 min)
            </button>
          )}
          {!touch && (
            <button type="button" className={first ? '' : 'primary'} onClick={() => newGame({})}>
              <Play size={16} /> Jouer
            </button>
          )}
          <button type="button" onClick={() => newGame({ autoplay: true })}>
            <Bot size={16} /> Démo automatique
          </button>
          <a href="./edit?mairie" className="aoe-link">
            Voir la mairie dans l’éditeur
          </a>
        </div>
        {!touch && first && <p className="aoe-small">Première partie ? Commencez par le didacticiel : il vous apprend à jouer en jouant.</p>}
        {touch && <p className="aoe-small">Le jeu se pilote à la souris et au clavier ; sur écran tactile, regardez la démo automatique.</p>}
        <p className="aoe-small">Modèle simplifié à visée pédagogique : il ne remplace pas l’évaluation des risques de votre collectivité.</p>
      </div>
    </div>
  );
}

const ADVICE = {
  du: 'Évaluez chaque unité de travail dès qu’elle démarre (et même pendant la construction d’un bâtiment) : c’est le document unique.',
  sensibilises: 'Construisez tôt la salle de formation et envoyez-y vos agents par petits groupes : ils se protègent et signalent les dangers.',
  accidents: 'Un danger signalé doit être neutralisé vite par le préventeur ; un point sécurité près des chantiers en réduit le nombre.',
  registres: 'Plus d’agents sensibilisés au travail, l’application DigiRisk et des points sécurité : les remontées s’accélèrent.',
};

function EndScreen() {
  const g = store.game;
  const o = g.outcome;
  const s = o?.score || scoreOf(g);
  const parts = [
    ['du', 'Document unique', FileCheck],
    ['sensibilises', 'Salariés sensibilisés', GraduationCap],
    ['accidents', 'Accidents', TriangleAlert],
    ['registres', 'Registres remontés', ClipboardList],
  ];
  const weakest = [...parts].sort((a, b) => s.parts[a[0]] - s.parts[b[0]]).slice(0, 2);
  // Durée en temps de jeu : mois et jours de l'année (le didacticiel ne compte pas)
  const elapsed = Math.min(yearTime(g), MONTH * YEAR_MONTHS);
  const months = Math.floor(elapsed / MONTH);
  const days = Math.round((elapsed % MONTH) / (MONTH / 30));
  const duration = [months ? `${months} mois` : '', days ? `${days} jour${days > 1 ? 's' : ''}` : ''].filter(Boolean).join(' et ') || 'moins d’un jour';
  return (
    <div className="aoe-screen dim">
      <div className="aoe-card">
        <h1>{o?.result === 'victory' ? 'Culture de prévention atteinte !' : o?.result === 'defeat' ? 'Activité suspendue' : 'Fin de l’année'}</h1>
        <p className="lead">
          {o?.reason} — {o?.result === 'yearEnd' ? 'au bout des 12 mois' : `en ${duration}`}
        </p>
        <div className="aoe-stars">
          {[0, 1, 2].map((i) => (
            <Star key={i} size={34} className={i < s.stars ? 'on' : ''} />
          ))}
          <strong>{s.total} / 1 000</strong>
        </div>
        <div className="aoe-score">
          {parts.map(([key, label, Icon]) => (
            <div key={key}>
              <Icon size={16} />
              <span>{label}</span>
              <i>
                <b style={{ width: `${(s.parts[key] / 250) * 100}%` }} />
              </i>
              <strong>{s.parts[key]} / 250</strong>
            </div>
          ))}
        </div>
        <h3>Pour la prochaine partie</h3>
        <ul>
          {weakest.map(([key]) => (
            <li key={key}>{ADVICE[key]}</li>
          ))}
        </ul>
        <div className="aoe-buttons">
          <button type="button" className="primary" onClick={() => newGame({})}>
            <RotateCcw size={16} /> Rejouer
          </button>
          <button type="button" onClick={() => newGame({ autoplay: true })}>
            <Bot size={16} /> Démo automatique
          </button>
          <button type="button" onClick={backToStart}>
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Raccourcis, sélection par rectangle                                  */
/* ------------------------------------------------------------------ */

function useShortcuts() {
  useEffect(() => {
    const key = (e) => {
      if (!store.game || store.ui.screen !== 'game' || e.target?.closest?.('input, textarea')) return;
      const ui = store.ui;
      if (ui.help) {
        if (e.code === 'Escape') closeHelp();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setUi({ paused: !ui.paused });
      } else if (e.code === 'Digit1') setUi({ speed: 1, paused: false });
      else if (e.code === 'Digit2') setUi({ speed: 2, paused: false });
      else if (e.code === 'Digit3') setUi({ speed: 4, paused: false });
      else if (e.code === 'Escape') {
        if (ui.placing) setUi({ placing: null, ghost: null });
        else clearSelection();
      } else if (e.code === 'KeyR' && ui.placing) setUi({ rot: (ui.rot + 90) % 360 });
      else if (e.code === 'KeyH') {
        const p = store.game.units.filter((u) => u.type === 'preventeur' && !u.hidden);
        if (!p.length) return;
        const cur = p.findIndex((u) => ui.selection[0] === u.id);
        const next = p[(cur + 1) % p.length];
        store.ui.selection = [next.id];
        lookAt(next.x, next.z);
        emit();
      } else if (e.code === 'Period') {
        const idle = store.game.units.filter((u) => u.type === 'agent' && !u.task && !u.hidden && !u.injured);
        if (!idle.length) return;
        store.ui.selection = idle.map((u) => u.id);
        lookAt(idle[0].x, idle[0].z);
        emit();
      } else if (e.code === 'KeyF') {
        const u = store.game.units.find((x) => x.id === ui.selection[0]) || store.game.buildings.find((x) => x.id === ui.selection[0]);
        if (u) lookAt(u.x, u.z);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
}

/** Rectangle de sélection des agents (glisser au clic gauche sur la carte). */
function BoxSelect({ host }) {
  const [box, setBox] = useState(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return undefined;
    let start = null;
    const down = (e) => {
      if (e.button !== 0 || e.target.tagName !== 'CANVAS' || store.ui.placing) return;
      start = [e.clientX, e.clientY];
    };
    const move = (e) => {
      if (!start) return;
      if (Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 6) setBox([start[0], start[1], e.clientX, e.clientY]);
    };
    const up = (e) => {
      if (!start) return;
      const s = start;
      start = null;
      setBox(null);
      if (Math.hypot(e.clientX - s[0], e.clientY - s[1]) <= 6 || !store.cam || !store.canvas) return;
      const r = store.canvas.getBoundingClientRect();
      const [x0, x1] = [Math.min(s[0], e.clientX), Math.max(s[0], e.clientX)];
      const [y0, y1] = [Math.min(s[1], e.clientY), Math.max(s[1], e.clientY)];
      const v = new THREE.Vector3();
      const picked = store.game.units.filter((u) => {
        if (u.hidden) return false;
        v.set(u.x, 0.6, u.z).project(store.cam);
        const sx = r.left + ((v.x + 1) / 2) * r.width;
        const sy = r.top + ((1 - v.y) / 2) * r.height;
        return sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1;
      });
      store.ui.selection = e.shiftKey ? [...new Set([...store.ui.selection, ...picked.map((u) => u.id)])] : picked.map((u) => u.id);
      emit();
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [host]);
  if (!box) return null;
  return <div className="aoe-box" style={{ left: Math.min(box[0], box[2]), top: Math.min(box[1], box[3]), width: Math.abs(box[2] - box[0]), height: Math.abs(box[3] - box[1]) }} />;
}

/* ------------------------------------------------------------------ */
/* Interface de jeu                                                     */
/* ------------------------------------------------------------------ */

export default function AoeHud({ host }) {
  useAoe();
  useShortcuts();
  const g = store.game;
  const ui = store.ui;
  if (!g) return null;
  const showError = ui.error && performance.now() - ui.errorAt < 3500;
  const step = tutoStep();
  return (
    <>
      <TopBar />
      <div className={`aoe-left ${store.tuto ? 'tuto' : ''}`}>
        {store.tuto ? (
          <>
            <TutorialCard />
            {step?.id === STEPS[STEPS.length - 1].id && <HintPanel />}
          </>
        ) : ui.autoplay ? (
          <div className="aoe-hint demo">
            <h3>
              <Bot size={15} /> Démo automatique
            </h3>
            <p>La cité est jouée par un joueur équilibré : économie, évaluations, formations, signalements.</p>
            <button type="button" onClick={() => setUi({ autoplay: false, speed: 1 })}>
              <Hand size={15} /> Prendre la main
            </button>
          </div>
        ) : (
          <HintPanel />
        )}
        <Notes />
      </div>
      <KpiPanel />
      <div className="aoe-bottom">
        <SelectionPanel />
        <div className="aoe-mini">
          <IdleButton />
          <Minimap />
        </div>
      </div>
      {ui.placing && (
        <div className="aoe-placing">
          Pose : <strong>{BUILDINGS[ui.placing].label}</strong> — clic gauche pour poser (Maj : plusieurs), R pour pivoter, clic droit ou Échap pour annuler
        </div>
      )}
      {showError && <div className="aoe-error">{ui.error}</div>}
      {ui.paused && !ui.help && !step?.read && <div className="aoe-paused">Pause</div>}
      <BoxSelect host={host} />
      {store.tuto && <FocusRing />}
      {ui.help && <HelpPanel />}
      {ui.screen === 'end' && <EndScreen />}
    </>
  );
}

export { visibleAt };
