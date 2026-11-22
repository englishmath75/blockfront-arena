const rad = Math.PI / 180;

export function alternateAttack(id) {
  return ['melee', 'blades', 'classic', 'bucky'].includes(id);
}

export function shotPattern(id, alt, count, stats, speed, airborne, bloom) {
  if (id === 'blades')
    return { count: alt ? count : 1, cone: alt ? 5 * rad : 0, interval: alt ? 0.45 : 1 / 6 };
  if (id === 'classic' && alt) {
    const error = airborne ? 4.1 : speed > 4 ? 3.2 : speed > 0.35 ? 2.5 : 1.9;
    return {
      count: Math.min(count, stats.alt.shotgunPelletCount),
      cone: error * rad + bloom,
      interval: 1 / stats.alt.burstRate,
    };
  }
  return null;
}

export function meleeDamage(heavy, yaw, targetYaw) {
  const behind = Math.cos(yaw - targetYaw) > Math.cos(Math.PI / 3);
  return (heavy ? 75 : 50) * (behind ? 2 : 1);
}
