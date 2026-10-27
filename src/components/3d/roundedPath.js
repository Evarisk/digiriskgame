import * as THREE from 'three';

/**
 * Construit une trajectoire industrielle lisse (segments rectilignes strictement centrés
 * dans les couloirs piétons + virages à 90° arrondis par courbes de Bézier quadratiques).
 */
export function buildRoundedIndustrialCurve(rawWaypoints, cornerRadius = 0.42) {
  const pts = [];
  for (const p of rawWaypoints) {
    const v = new THREE.Vector3(p[0], p[1], p[2]);
    if (!pts.length || pts[pts.length - 1].distanceTo(v) > 0.05) {
      pts.push(v);
    }
  }

  const curvePath = new THREE.CurvePath();
  if (pts.length < 2) {
    curvePath.add(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(1, 0, 0)));
    return curvePath;
  }

  let currentStart = pts[0].clone();

  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1];
    const corner = pts[i];
    const next = pts[i + 1];

    const vIn = new THREE.Vector3().subVectors(corner, prev);
    const vOut = new THREE.Vector3().subVectors(next, corner);
    const lenIn = vIn.length();
    const lenOut = vOut.length();
    const r = Math.min(cornerRadius, lenIn * 0.42, lenOut * 0.42);

    if (r > 0.04) {
      const enterPt = corner.clone().addScaledVector(vIn.normalize(), -r);
      const exitPt = corner.clone().addScaledVector(vOut.normalize(), r);
      if (currentStart.distanceTo(enterPt) > 0.02) {
        curvePath.add(new THREE.LineCurve3(currentStart, enterPt));
      }
      curvePath.add(new THREE.QuadraticBezierCurve3(enterPt, corner.clone(), exitPt));
      currentStart = exitPt;
    } else if (currentStart.distanceTo(corner) > 0.02) {
      curvePath.add(new THREE.LineCurve3(currentStart, corner.clone()));
      currentStart = corner.clone();
    }
  }

  const lastPt = pts[pts.length - 1];
  if (currentStart.distanceTo(lastPt) > 0.02) {
    curvePath.add(new THREE.LineCurve3(currentStart, lastPt));
  }

  curvePath.arcLengthDivisions = 360;
  curvePath.updateArcLengths();
  return curvePath;
}
