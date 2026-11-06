import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { store, tick, useAoe } from './aoeStore';
import { tutoTick } from './aoeTutorial';
import AoeHud, { StartScreen } from './AoeHud';
import '../../styles/aoe.css';

// La 3D n'est chargée qu'au lancement d'une partie (l'accueil s'affiche tout de suite)
const AoeCanvas = lazy(() => import('./AoeCanvas'));

/**
 * Cité Prévention (page /aoe) : jeu de stratégie en temps réel DigiRisk. Accueil, partie (3D + interface), fin de
 * partie. La simulation avance hors du Canvas, au rythme de l'affichage (requestAnimationFrame).
 */
export default function AoeApp() {
  useAoe();
  const host = useRef();
  useEffect(() => {
    document.title = 'Cité Prévention — DigiRisk';
    let last = performance.now();
    let raf = requestAnimationFrame(function loop(now) {
      tick((now - last) / 1000);
      tutoTick();
      last = now;
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  const playing = store.game && store.ui.screen !== 'start';
  return (
    <div className="aoe-app" ref={host} onContextMenu={(e) => e.preventDefault()}>
      {playing ? (
        <Suspense fallback={<div className="aoe-loading">Chargement de la cité…</div>}>
          <AoeCanvas />
          <AoeHud host={host} />
        </Suspense>
      ) : (
        <StartScreen />
      )}
    </div>
  );
}
