import React, { useEffect, useState } from 'react';
import { GraduationCap, Check, MousePointerClick, ChevronRight, X, Mouse, Keyboard, Target, ListOrdered, FileCheck, TriangleAlert, ClipboardList, Hourglass } from 'lucide-react';
import { store, setUi, newGame } from './aoeStore';
import { STEPS, tutoStep, tutoNext, finishTutorial, tutoFocus } from './aoeTutorial';

/** Texte des étapes : **gras** et `touche`. */
function rich(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`')) return <kbd key={i}>{part.slice(1, -1)}</kbd>;
    return part;
  });
}

/** Carte du didacticiel (colonne de gauche) : étape, consigne, progression. */
export function TutorialCard() {
  const t = store.tuto;
  const s = tutoStep();
  if (!t || !s) return null;
  const body = typeof s.body === 'function' ? s.body(store.game, t.base) : s.body;
  const done = Boolean(t.pendingAt);
  return (
    <div className={`aoe-tuto ${done ? 'done' : ''}`}>
      <div className="aoe-tuto-head">
        <GraduationCap size={15} />
        <span>
          Didacticiel · {t.i + 1} / {STEPS.length}
        </span>
        <button type="button" onClick={() => finishTutorial(true)} title="Arrêter le didacticiel et jouer librement">
          Passer <X size={13} />
        </button>
      </div>
      <i className="aoe-tuto-progress">
        <b style={{ width: `${((t.i + (done ? 1 : 0)) / STEPS.length) * 100}%` }} />
      </i>
      <h3>{s.title}</h3>
      {body.map((p, k) => (
        <p key={k}>{rich(p)}</p>
      ))}
      {done ? (
        <div className="aoe-tuto-ok">
          <Check size={16} /> {s.ok || 'Bien joué !'}
        </div>
      ) : s.read ? (
        <button type="button" className="aoe-tuto-next" onClick={tutoNext}>
          {s.next || 'Suivant'} <ChevronRight size={15} />
        </button>
      ) : (
        <div className="aoe-tuto-todo">
          <MousePointerClick size={15} /> À vous !
          {s.skip && (
            <button type="button" onClick={tutoNext}>
              Étape suivante
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Cadre lumineux autour du bouton ou du panneau à utiliser pendant l'étape en cours. */
export function FocusRing() {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    const timer = setInterval(() => {
      const sel = tutoFocus();
      const el = sel && document.querySelector(sel);
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 ? { l: Math.round(r.left), t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null;
      setRect((prev) => (prev && next && prev.l === next.l && prev.t === next.t && prev.w === next.w && prev.h === next.h ? prev : next));
    }, 120);
    return () => clearInterval(timer);
  }, []);
  if (!rect) return null;
  return <div className="aoe-tuto-ring" style={{ left: rect.l - 5, top: rect.t - 5, width: rect.w + 10, height: rect.h + 10 }} />;
}

/* ------------------------------------------------------------------ */
/* Aide « Comment jouer »                                               */
/* ------------------------------------------------------------------ */

let pausedBefore = false;
export function openHelp() {
  pausedBefore = store.ui.paused;
  setUi({ help: true, paused: true });
}
export function closeHelp() {
  setUi({ help: false, paused: pausedBefore });
}

const MOUSE = [
  ['Clic gauche', 'sélectionner un agent, le préventeur, un bâtiment'],
  ['Glisser (clic gauche)', 'sélectionner plusieurs agents (Maj : ajouter)'],
  ['Clic droit', 'donner un ordre à la sélection (voir ci-dessous)'],
  ['Molette', 'zoomer'],
  ['Bouton du milieu', 'glisser pour déplacer la vue'],
  ['Minicarte', 'cliquer pour s’y rendre'],
];
const ORDERS = [
  ['Arbre, jardin, potager', 'les agents y travaillent (heures d’équipe)'],
  ['Chantier de voirie', 'les agents y travaillent (budget)'],
  ['Bâtiment en chantier', 'les agents construisent'],
  ['Salle de formation', 'les agents vont se former'],
  ['Lieu « DU ? », avec le préventeur', 'il évalue l’unité de travail'],
  ['Danger ⚠, avec le préventeur', 'il le neutralise'],
  ['Sol', 'se déplacer'],
];
const KEYS = [
  ['Z Q S D / flèches', 'déplacer la vue'],
  ['Espace', 'pause'],
  ['1 · 2 · 3', 'vitesse ×1, ×2, ×4'],
  ['H', 'préventeur suivant'],
  ['.', 'agents inoccupés'],
  ['F', 'centrer sur la sélection'],
  ['R', 'pivoter le bâtiment à poser'],
  ['Échap', 'annuler, désélectionner'],
];

export function HelpPanel() {
  const restartTutorial = () => newGame({ tutorial: true });
  return (
    <div className="aoe-screen dim" onPointerDown={(e) => e.target === e.currentTarget && closeHelp()}>
      <div className="aoe-card aoe-help">
        <button type="button" className="aoe-help-close" onClick={closeHelp} title="Fermer (Échap)">
          <X size={18} />
        </button>
        <h1>Comment jouer</h1>
        <p className="lead">
          <Target size={16} /> Faites grandir la commune et atteignez le palier 4, <strong>Culture de prévention</strong>, avant la fin de l’année, sans atteindre 12 accidents.
        </p>
        <div className="aoe-help-grid">
          <section>
            <h3>
              <Mouse size={15} /> À la souris
            </h3>
            <dl>
              {MOUSE.map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            <h3>
              <MousePointerClick size={15} /> Clic droit sur…
            </h3>
            <dl>
              {ORDERS.map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          </section>
          <section>
            <h3>
              <Keyboard size={15} /> Au clavier
            </h3>
            <dl>
              {KEYS.map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt>
                    <kbd>{k}</kbd>
                  </dt>
                  <dd>{v}</dd>
                </React.Fragment>
              ))}
            </dl>
            <h3>
              <ListOrdered size={15} /> Une partie en cinq temps
            </h3>
            <ol>
              <li>Mettre tous les agents au travail : heures d’équipe (bosquets, jardin) et budget (chantiers de voirie).</li>
              <li>Évaluer chaque unité de travail avec le préventeur (pastilles « DU ? »), sans épuiser son temps.</li>
              <li>Construire cantine et dépôt, recruter, puis franchir le palier 2 à l’hôtel de ville.</li>
              <li>Construire la salle de formation, y envoyer les agents, neutraliser les dangers signalés.</li>
              <li>Paliers 3 et 4 : DU complet, 80 % de sensibilisés, 12 registres, aucun accident depuis 45 jours.</li>
            </ol>
            <h3>
              <Hourglass size={15} /> Les ressources
            </h3>
            <dl>
              <dt>Heures d’équipe</dt>
              <dd>le travail des agents sur les sites, pointé au dépôt : construire, recruter</dd>
              <dt>Budget</dt>
              <dd>chantiers de voirie, impôts, commerces : former, s’équiper, préventeurs</dd>
              <dt>Temps préventeur</dt>
              <dd>réserve consommée par les évaluations et les dangers ; se recharge, grandit avec chaque préventeur</dd>
              <dt>Remontées</dt>
              <dd>idées d’amélioration des agents sensibilisés</dd>
            </dl>
            <p className="aoe-small">Une année de jeu dure 12 minutes : un mois passe en une minute, une journée en deux secondes.</p>
          </section>
        </div>
        <div className="aoe-help-kpis">
          <span>
            <FileCheck size={14} /> DU : le préventeur évalue chaque lieu de travail
          </span>
          <span>
            <GraduationCap size={14} /> Sensibilisés : salle de formation
          </span>
          <span>
            <TriangleAlert size={14} /> Accidents : neutraliser les dangers ⚠
          </span>
          <span>
            <ClipboardList size={14} /> Registres : signalements des agents formés
          </span>
        </div>
        <div className="aoe-buttons">
          <button type="button" className="primary" onClick={closeHelp}>
            Reprendre la partie
          </button>
          <button type="button" onClick={restartTutorial} title="Nouvelle partie guidée pas à pas">
            <GraduationCap size={16} /> Recommencer avec le didacticiel
          </button>
        </div>
      </div>
    </div>
  );
}
