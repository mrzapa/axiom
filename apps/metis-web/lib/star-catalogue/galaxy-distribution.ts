import { SeededRNG } from "./rng";

export interface GalaxyDistributionConfig {
  numArms: number;
  armWindingRate: number;
  coreRadius: number;
  diskFalloff: number;
}

/**
 * Galaxy-scale density factor for a sector centred at (centerWx, centerWy).
 * Returns [0, 1]: 1 = maximum density (galactic core), 0 = empty void.
 *
 * Galaxy radius is expressed in world units. numArms / armWindingRate drive
 * the global spiral arm structure so the whole starfield has coherent shape.
 */
export function galaxyDensityFactor(
  centerWx: number,
  centerWy: number,
  numArms: number,
  armWindingRate: number,
  galaxyRadiusWu: number,
): number {
  const nx = centerWx / galaxyRadiusWu;
  const ny = centerWy / galaxyRadiusWu;
  const r = Math.sqrt(nx * nx + ny * ny);

  // Minimum background density so the outer void isn't pitch-black.
  const minDensity = 0.03;

  if (r > 2.5) return minDensity;

  const theta = Math.atan2(ny, nx);

  // Galactic core: tight Gaussian
  const coreDensity = Math.exp(-(r * r) / 0.012);

  // Exponential disk falloff
  const diskDensity = Math.exp(-r * 2.6);

  // Global spiral arms
  let armDensity = 0;
  for (let arm = 0; arm < numArms; arm++) {
    const armOffset = (arm / numArms) * Math.PI * 2;
    const armAngle = armOffset + r * armWindingRate * 0.35;
    let dAngle = theta - armAngle;
    // Normalise to [-π, π]
    dAngle -= Math.round(dAngle / (Math.PI * 2)) * (Math.PI * 2);
    const armWidth = 0.25 + r * 0.18;
    armDensity = Math.max(armDensity, Math.exp(-(dAngle * dAngle) / (armWidth * armWidth)));
  }

  const density = coreDensity * 0.25 + diskDensity * 0.5 + armDensity * diskDensity * 0.65;
  return Math.min(1, Math.max(minDensity, density));
}

/**
 * Generate a world-space position for a star within a galaxy.
 * Returns position in approximately [-1, 1] range with spiral arm structure.
 */
export function sampleGalaxyPosition(
  rng: SeededRNG,
  cfg: GalaxyDistributionConfig,
): { wx: number; wy: number; depthLayer: number } {
  const roll = rng.next();
  let wx: number;
  let wy: number;

  if (roll < 0.15) {
    // Galactic core: tight Gaussian blob
    const r = Math.abs(rng.gaussian()) * cfg.coreRadius;
    const theta = rng.next() * Math.PI * 2;
    wx = Math.cos(theta) * r;
    wy = Math.sin(theta) * r;
  } else if (roll < 0.85) {
    // Spiral arm
    const armIndex = rng.int(cfg.numArms);
    const armOffset = (armIndex / cfg.numArms) * Math.PI * 2;
    const rawRadius = -Math.log(1 - rng.next() * 0.9999) / cfg.diskFalloff;
    const r = Math.min(rawRadius, 1.0);
    const armAngle = armOffset + r * cfg.armWindingRate;
    const scatter = rng.range(-0.04, 0.04) * (0.5 + r);
    const theta = armAngle + scatter;
    wx = Math.cos(theta) * r;
    wy = Math.sin(theta) * r;
  } else {
    // Halo: uniform disk, low density
    const r = rng.next() * 0.9 + 0.05;
    const theta = rng.next() * Math.PI * 2;
    wx = Math.cos(theta) * r;
    wy = Math.sin(theta) * r;
  }

  // Depth layer loosely correlated with distance from centre
  const dist = Math.hypot(wx, wy);
  const depthLayer = 0.3 + rng.next() * 0.4 + dist * 0.3;

  return { wx, wy, depthLayer: Math.min(1, depthLayer) };
}
