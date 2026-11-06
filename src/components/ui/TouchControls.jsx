import React, { useRef } from 'react';
import { Footprints, Eye } from 'lucide-react';
import { touchInput } from '../../services/touchControls';
import '../../styles/touch-controls.css';

/**
 * Joysticks à l'écran des visites en première personne (téléphone, tablette, Samsung DeX) : joystick gauche
 * pour se déplacer (vitesse selon la poussée), joystick droit pour tourner la tête, et glissé du doigt
 * n'importe où ailleurs pour regarder. Chaque commande suit son propre doigt (les deux pouces à la fois).
 * Pointer Events : fonctionne aussi à la souris. `children` : boutons d'action affichés à côté du joystick
 * droit (classe `walk-touch-btn`). L'état est lu par les contrôleurs de caméra (services/touchControls.js).
 */

const DEAD_ZONE = 0.12;

function Stick({ side, label, icon, onChange }) {
  const baseRef = useRef(null);
  const knobRef = useRef(null);
  const active = useRef(null); // { id, cx, cy, radius } : doigt suivi, centre et course du joystick

  const place = (x, y) => {
    if (knobRef.current) knobRef.current.style.transform = `translate(${x}px, ${y}px)`;
  };
  const update = (e) => {
    const a = active.current;
    if (!a || e.pointerId !== a.id) return;
    let dx = e.clientX - a.cx;
    let dy = e.clientY - a.cy;
    const d = Math.hypot(dx, dy);
    if (d > a.radius) {
      dx = (dx / d) * a.radius;
      dy = (dy / d) * a.radius;
    }
    place(dx, dy);
    const mag = Math.min(1, d / a.radius);
    // Zone morte au centre, puis réponse progressive jusqu'au bord
    const k = mag < DEAD_ZONE ? 0 : (mag - DEAD_ZONE) / (1 - DEAD_ZONE) / (mag || 1);
    onChange([(dx / a.radius) * k, (dy / a.radius) * k]);
  };
  const release = (e) => {
    if (!active.current || e.pointerId !== active.current.id) return;
    active.current = null;
    baseRef.current?.classList.remove('active');
    place(0, 0);
    onChange([0, 0]);
  };

  return (
    <div
      ref={baseRef}
      className={`walk-stick ${side}`}
      role="application"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (active.current) return;
        const rect = baseRef.current.getBoundingClientRect();
        // Course du bouton : 40 % du diamètre (la taille du joystick suit celle de l'écran)
        active.current = { id: e.pointerId, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2, radius: rect.width * 0.4 };
        baseRef.current.classList.add('active');
        baseRef.current.setPointerCapture?.(e.pointerId);
        update(e);
      }}
      onPointerMove={update}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span className="walk-stick-label">
        {icon} {label}
      </span>
      <div ref={knobRef} className="walk-stick-knob" />
    </div>
  );
}

export default function TouchControls({ children }) {
  const swipe = useRef(null); // { id, x, y } : doigt qui fait tourner le regard
  const endSwipe = (e) => {
    if (swipe.current?.id === e.pointerId) swipe.current = null;
  };

  return (
    <div className="walk-touch">
      {/* Glissé du doigt sur le reste de l'écran : regarder */}
      <div
        className="walk-touch-look"
        onPointerDown={(e) => {
          if (swipe.current) return;
          swipe.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          const s = swipe.current;
          if (!s || e.pointerId !== s.id) return;
          touchInput.swipe[0] += e.clientX - s.x;
          touchInput.swipe[1] += e.clientY - s.y;
          s.x = e.clientX;
          s.y = e.clientY;
        }}
        onPointerUp={endSwipe}
        onPointerCancel={endSwipe}
        onLostPointerCapture={endSwipe}
      />
      <Stick side="left" label="Se déplacer" icon={<Footprints size={12} />} onChange={(v) => (touchInput.move = v)} />
      <Stick side="right" label="Regarder" icon={<Eye size={12} />} onChange={(v) => (touchInput.look = v)} />
      {children && <div className="walk-touch-actions">{children}</div>}
    </div>
  );
}
