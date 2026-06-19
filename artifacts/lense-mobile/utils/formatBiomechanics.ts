const TERM_MAP: Array<[RegExp, string]> = [
  [/knee valgus/gi, "knee caving inward"],
  [/knee varus/gi, "knee bowing outward"],
  [/valgus collapse/gi, "knee caving inward"],
  [/lumbar flexion/gi, "lower back rounding"],
  [/lumbar hyperextension/gi, "lower back arching too much"],
  [/lumbar lordosis/gi, "lower back curve"],
  [/lumbar/gi, "lower back"],
  [/thoracic kyphosis/gi, "upper back rounding"],
  [/thoracic extension/gi, "upper back opening up"],
  [/thoracic/gi, "upper back"],
  [/cervical/gi, "neck"],
  [/anterior pelvic tilt/gi, "pelvis tilting forward"],
  [/posterior pelvic tilt/gi, "pelvis tucking under"],
  [/pelvic rotation/gi, "pelvis rotating"],
  [/hip flexion/gi, "hip bending forward"],
  [/hip extension/gi, "hips opening back"],
  [/hip abduction/gi, "leg moving out to the side"],
  [/hip adduction/gi, "leg crossing inward"],
  [/hip drop/gi, "hip dipping to one side"],
  [/shoulder impingement/gi, "shoulder pinching"],
  [/shoulder protraction/gi, "shoulders rounding forward"],
  [/shoulder retraction/gi, "shoulders pulling back"],
  [/shoulder elevation/gi, "shoulders shrugging up"],
  [/elbow valgus/gi, "elbow flaring out"],
  [/wrist extension/gi, "wrist bending back"],
  [/wrist flexion/gi, "wrist bending forward"],
  [/ankle dorsiflexion/gi, "ankle flexibility"],
  [/ankle plantar flexion/gi, "ankle pointing"],
  [/excessive forward lean/gi, "leaning too far forward"],
  [/forward head posture/gi, "head jutting forward"],
  [/proprioception/gi, "body position awareness"],
  [/neuromuscular/gi, "muscle control"],
  [/musculoskeletal/gi, "muscle and joint"],
  [/biomechanical/gi, "movement"],
  [/biomechanics/gi, "movement mechanics"],
  [/kinetic chain/gi, "movement chain"],
  [/glenohumeral/gi, "shoulder joint"],
  [/patellofemoral/gi, "kneecap"],
  [/tibiofemoral/gi, "knee joint"],
  [/glenohumeral joint/gi, "shoulder"],
  [/tibia/gi, "shin bone"],
  [/femur/gi, "thigh bone"],
  [/fibula/gi, "lower leg bone"],
  [/valgus/gi, "inward angle"],
  [/varus/gi, "outward angle"],
  [/\bROM\b/g, "range of motion"],
  [/dorsiflexion/gi, "ankle flexibility"],
  [/plantar flexion/gi, "ankle pointing"],
  [/pronation/gi, "foot rolling inward"],
  [/supination/gi, "foot rolling outward"],
  [/abduction/gi, "moving out to the side"],
  [/adduction/gi, "moving inward"],
  [/flexion/gi, "bending"],
  [/extension/gi, "straightening"],
  [/eccentric/gi, "controlled lowering"],
  [/concentric/gi, "pushing phase"],
  [/isometric/gi, "hold position"],
  [/hyperextension/gi, "overextending"],
];

export function formatBiomechanicsText(raw: string): string {
  if (!raw) return raw;
  let result = raw;
  for (const [pattern, replacement] of TERM_MAP) {
    result = result.replace(pattern, replacement);
  }
  if (result.length > 0) {
    result = result.charAt(0).toUpperCase() + result.slice(1);
  }
  return result;
}
