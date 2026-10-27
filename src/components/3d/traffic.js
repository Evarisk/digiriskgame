/**
 * Circulation sur le site, partagée entre les animations : positions des piétons et des véhicules
 * (un véhicule s'arrête devant un obstacle sur sa trajectoire) et barrière du poste de garde,
 * levée à la demande des véhicules qui approchent.
 */
export const traffic = {
  pedestrians: new Map(), // id -> THREE.Vector3 : position monde d'un opérateur animé
  vehicles: new Map(), // id -> [{ x, z }, ...] : points d'encombrement d'un véhicule
  gate: { open: 0, requestUntil: 0 }, // ouverture de la barrière (0 baissée, 1 levée) ; demande jusqu'à t (s)
};
