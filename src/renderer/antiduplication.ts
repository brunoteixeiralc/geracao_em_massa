export type AntiduplicationVariant = {
  brightness: number;
  contrast: number;
  saturation: number;
  noiseStrength: number;
  noiseSeed: number;
  audioVolume: number;
  videoCrf: number;
  gopSize: number;
  metadataComment: string;
};

export function buildAntiduplicationVariant(seed: string): AntiduplicationVariant {
  const hash = hashString(seed);

  return {
    brightness: round(range(hash, 1, -0.004, 0.004), 4),
    contrast: round(range(hash, 2, 0.996, 1.006), 4),
    saturation: round(range(hash, 3, 0.996, 1.008), 4),
    noiseStrength: Math.round(range(hash, 4, 1, 2)),
    noiseSeed: Math.floor(range(hash, 5, 1, 2_147_483_000)),
    audioVolume: round(range(hash, 6, 0.985, 1.015), 4),
    videoCrf: Math.round(range(hash, 7, 22, 24)),
    gopSize: Math.round(range(hash, 8, 54, 72)),
    metadataComment: `em-massa-${hash.toString(16).padStart(8, "0")}`
  };
}

function hashString(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash;
}

function range(hash: number, salt: number, min: number, max: number) {
  const mixed = mix(hash, salt);
  return min + (mixed / 0xffffffff) * (max - min);
}

function mix(hash: number, salt: number) {
  let value = (hash ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function round(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
