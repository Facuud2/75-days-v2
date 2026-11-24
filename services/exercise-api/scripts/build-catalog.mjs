#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '../..');

const RAW_PATH = path.join(ROOT, 'data/raw-exercises.json');
const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

const MUSCLE_ES = {
  abdominals: 'Abdominales',
  abductors: 'Abductores',
  adductors: 'Aductores',
  biceps: 'Bíceps',
  calves: 'Gemelos',
  chest: 'Pecho',
  forearms: 'Antebrazos',
  glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales',
  lats: 'Dorsales',
  'lower back': 'Espalda baja',
  'middle back': 'Espalda media',
  neck: 'Cuello',
  quadriceps: 'Cuádriceps',
  shoulders: 'Hombros',
  traps: 'Trapecios',
  triceps: 'Tríceps',
};

const MUSCLE_TO_ZONE = {
  chest: 'chest',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  traps: 'back',
  shoulders: 'shoulders',
  neck: 'shoulders',
  biceps: 'arms',
  triceps: 'arms',
  forearms: 'arms',
  quadriceps: 'legs',
  hamstrings: 'legs',
  glutes: 'legs',
  calves: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  abdominals: 'core',
};

const ZONE_LABELS_ES = {
  chest: 'Pecho',
  back: 'Espalda',
  legs: 'Piernas',
  shoulders: 'Hombros',
  arms: 'Brazos',
  core: 'Core',
  cardio: 'Cardio',
};

const EQUIPMENT_ES = {
  'body only': 'Peso corporal',
  barbell: 'Barra',
  dumbbell: 'Mancuernas',
  cable: 'Polea',
  machine: 'Máquina',
  kettlebells: 'Pesa rusa (Kettlebell)',
  bands: 'Bandas elásticas',
  'e-z curl bar': 'Barra Z',
  'exercise ball': 'Fitball',
  'medicine ball': 'Balón medicinal',
  'foam roll': 'Rodillo de espuma',
  other: 'Otro',
  none: 'Sin equipo',
};

const CATEGORY_ES = {
  strength: 'Fuerza',
  stretching: 'Estiramiento',
  plyometrics: 'Pliometría',
  strongman: 'Strongman',
  powerlifting: 'Powerlifting',
  cardio: 'Cardio',
  'olympic weightlifting': 'Halterofilia',
};

const LEVEL_ES = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  expert: 'Avanzado',
};

const FORCE_ES = {
  push: 'Empuje',
  pull: 'Tracción',
  static: 'Estático',
};

const MECHANIC_ES = {
  compound: 'Compuesto',
  isolation: 'Aislamiento',
};

// Diccionario de frases compuestas (ordenado de mayor a menor longitud para match exacto)
const PHRASE_TRANSLATIONS = [
  ['barbell bench press', 'Press de banca con barra'],
  ['dumbbell bench press', 'Press de banca con mancuernas'],
  ['incline dumbbell press', 'Press inclinado con mancuernas'],
  ['incline barbell bench press', 'Press de banca inclinado con barra'],
  ['decline barbell bench press', 'Press de banca declinado con barra'],
  ['decline dumbbell bench press', 'Press declinado con mancuernas'],
  ['close-grip barbell bench press', 'Press de banca agarre cerrado'],
  ['romanian deadlift', 'Peso muerto rumano'],
  ['stiff-legged barbell deadlift', 'Peso muerto piernas rígidas con barra'],
  ['sumo deadlift', 'Peso muerto sumo'],
  ['barbell deadlift', 'Peso muerto con barra'],
  ['barbell squat', 'Sentadilla con barra'],
  ['barbell full squat', 'Sentadilla profunda con barra'],
  ['front barbell squat', 'Sentadilla frontal con barra'],
  ['goblet squat', 'Sentadilla copa (Goblet)'],
  ['bulgarian split squat', 'Sentadilla búlgara'],
  ['split squat', 'Sentadilla dividida'],
  ['hack squat', 'Sentadilla Hack'],
  ['box squat', 'Sentadilla al cajón'],
  ['bodyweight squat', 'Sentadilla corporal'],
  ['overhead press', 'Press militar'],
  ['military press', 'Press militar'],
  ['shoulder press', 'Press de hombros'],
  ['arnold dumbbell press', 'Press Arnold con mancuernas'],
  ['lateral raise', 'Elevaciones laterales'],
  ['side lateral raise', 'Elevaciones laterales'],
  ['front raise', 'Elevaciones frontales'],
  ['rear delt fly', 'Pájaros (deltoides posterior)'],
  ['lat pulldown', 'Jalón al pecho'],
  ['wide-grip lat pulldown', 'Jalón al pecho agarre ancho'],
  ['close-grip front lat pulldown', 'Jalón al pecho agarre cerrado'],
  ['seated cable rows', 'Remo sentado en polea'],
  ['bent over barbell row', 'Remo con barra inclinado'],
  ['one-arm dumbbell row', 'Remo con mancuerna a un brazo'],
  ['t-bar row', 'Remo en barra T'],
  ['pull-ups', 'Dominadas'],
  ['pullups', 'Dominadas'],
  ['chin-up', 'Dominadas supinas'],
  ['chin-ups', 'Dominadas supinas'],
  ['push-ups', 'Flexiones'],
  ['pushups', 'Flexiones'],
  ['chest dip', 'Fondos para pecho'],
  ['triceps dip', 'Fondos para tríceps'],
  ['dips', 'Fondos'],
  ['leg press', 'Prensa de piernas'],
  ['leg extensions', 'Extensión de cuádriceps'],
  ['leg extension', 'Extensión de cuádriceps'],
  ['lying leg curls', 'Curl femoral tumbado'],
  ['seated leg curl', 'Curl femoral sentado'],
  ['standing calf raises', 'Elevación de talones de pie'],
  ['seated calf raise', 'Elevación de talones sentado'],
  ['hip thrust', 'Empuje de cadera (Hip Thrust)'],
  ['glute bridge', 'Puente de glúteos'],
  ['barbell curl', 'Curl de bíceps con barra'],
  ['dumbbell bicep curl', 'Curl de bíceps con mancuernas'],
  ['hammer curls', 'Curl martillo'],
  ['hammer curl', 'Curl martillo'],
  ['preacher curl', 'Curl predicador'],
  ['concentration curls', 'Curl concentrado'],
  ['triceps pushdown', 'Extensión de tríceps en polea'],
  ['skull crushers', 'Press francés'],
  ['cable crossover', 'Cruce de poleas'],
  ['dumbbell flyes', 'Aperturas con mancuernas'],
  ['face pull', 'Face Pull en polea'],
  ['hanging leg raise', 'Elevación de piernas colgado'],
  ['russian twist', 'Giro ruso'],
  ['mountain climbers', 'Escaladores'],
  ['jumping jacks', 'Saltos de tijera'],
  ['burpees', 'Burpees'],
  ['plank', 'Plancha abdominal'],
  ['side plank', 'Plancha lateral'],
  ['sit-up', 'Abdominales (Sit-Up)'],
  ['crunches', 'Crunch abdominal'],
  ['crunch', 'Crunch abdominal'],
  ['lunge', 'Zancadas'],
  ['lunges', 'Zancadas'],
  ['step-up', 'Subidas al cajón'],
  ['farmers walk', 'Paseo del granjero'],
  ['kettlebell swing', 'Swing con pesa rusa'],
  ['clean and jerk', 'Cargada y envión'],
  ['power clean', 'Cargada de potencia'],
  ['snatch', 'Arrancada (Snatch)'],
  ['shrug', 'Encogimiento de hombros'],
  ['shrugs', 'Encogimiento de hombros'],
  ['hyperextensions', 'Hiperextensiones lumbares'],
  ['back extension', 'Extensión lumbar'],
  ['calf raise', 'Elevación de gemelos'],
  ['bench press', 'Press de banca'],
  ['deadlift', 'Peso muerto'],
  ['squat', 'Sentadilla'],
  ['row', 'Remo'],
  ['flyes', 'Aperturas'],
  ['fly', 'Aperturas'],
  ['stretch', 'Estiramiento'],
  ['running', 'Carrera'],
  ['jogging', 'Trote'],
  ['bicycling', 'Ciclismo'],
  ['elliptical', 'Elíptica'],
  ['rowing', 'Remo cardio'],
  ['rope jumping', 'Salto a la comba'],
  ['stairmaster', 'Escaladora'],
  ['treadmill', 'Cinta de correr'],
];

const WORD_REPLACEMENTS = [
  [/\bBarbell\b/gi, 'Barra'],
  [/\bDumbbell\b/gi, 'Mancuerna'],
  [/\bDumbbells\b/gi, 'Mancuernas'],
  [/\bKettlebell\b/gi, 'Pesa rusa'],
  [/\bCable\b/gi, 'Polea'],
  [/\bMachine\b/gi, 'Máquina'],
  [/\bSmith Machine\b/gi, 'Multipower'],
  [/\bBand\b/gi, 'Banda'],
  [/\bBodyweight\b/gi, 'Corporal'],
  [/\bIncline\b/gi, 'Inclinado'],
  [/\bDecline\b/gi, 'Declinado'],
  [/\bSeated\b/gi, 'Sentado'],
  [/\bStanding\b/gi, 'De pie'],
  [/\bLying\b/gi, 'Tumbado'],
  [/\bKneeling\b/gi, 'De rodillas'],
  [/\bBent Over\b/gi, 'Inclinado'],
  [/\bSingle-Arm\b/gi, 'Un brazo'],
  [/\bOne-Arm\b/gi, 'Un brazo'],
  [/\bOne Arm\b/gi, 'Un brazo'],
  [/\bSingle-Leg\b/gi, 'Una pierna'],
  [/\bOne-Leg\b/gi, 'Una pierna'],
  [/\bAlternating\b/gi, 'Alterno'],
  [/\bAlternate\b/gi, 'Alterno'],
  [/\bWide-Grip\b/gi, 'Agarre ancho'],
  [/\bClose-Grip\b/gi, 'Agarre cerrado'],
  [/\bReverse-Grip\b/gi, 'Agarre supino'],
  [/\bOverhead\b/gi, 'Sobre la cabeza'],
  [/\bChest\b/gi, 'Pecho'],
  [/\bShoulder\b/gi, 'Hombro'],
  [/\bShoulders\b/gi, 'Hombros'],
  [/\bBack\b/gi, 'Espalda'],
  [/\bLeg\b/gi, 'Pierna'],
  [/\bLegs\b/gi, 'Piernas'],
  [/\bArm\b/gi, 'Brazo'],
  [/\bHip\b/gi, 'Cadera'],
  [/\bGlute\b/gi, 'Glúteo'],
  [/\bCalf\b/gi, 'Gemelo'],
  [/\bWrist\b/gi, 'Muñeca'],
  [/\bNeck\b/gi, 'Cuello'],
  [/\bAbdominal\b/gi, 'Abdominal'],
  [/\bExtension\b/gi, 'Extensión'],
  [/\bExtensions\b/gi, 'Extensiones'],
  [/\bRaise\b/gi, 'Elevación'],
  [/\bRaises\b/gi, 'Elevaciones'],
  [/\bPullover\b/gi, 'Pullover'],
  [/\bKickback\b/gi, 'Patada'],
  [/\bRotation\b/gi, 'Rotación'],
  [/\bTwist\b/gi, 'Giro'],
  [/\bHold\b/gi, 'Isométrico'],
  [/\bJump\b/gi, 'Salto'],
  [/\bJumps\b/gi, 'Saltos'],
  [/\bWalk\b/gi, 'Caminata'],
  [/\bFloor\b/gi, 'Suelo'],
  [/\bBench\b/gi, 'Banco'],
  [/\bBall\b/gi, 'Balón'],
  [/\bFoam Roll\b/gi, 'Rodillo'],
  [/\bWith\b/gi, 'con'],
  [/\bOn\b/gi, 'en'],
  [/\bTo\b/gi, 'a'],
];

function translateExerciseName(nameEn) {
  const lower = nameEn.toLowerCase().trim();
  for (const [en, es] of PHRASE_TRANSLATIONS) {
    if (lower === en) return es;
  }

  let translated = nameEn;
  // Reemplazar frases clave dentro de nombres más largos
  for (const [en, es] of PHRASE_TRANSLATIONS) {
    if (en.includes(' ') || en.includes('-')) {
      const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(translated)) {
        translated = translated.replace(regex, es);
      }
    }
  }

  for (const [regex, replacement] of WORD_REPLACEMENTS) {
    translated = translated.replace(regex, replacement);
  }

  // Limpiar espacios múltiples y capitalizar primera letra
  translated = translated.replace(/\s+/g, ' ').trim();
  if (translated.length > 0) {
    translated = translated[0].toUpperCase() + translated.slice(1);
  }
  return translated;
}

function computeMetValue(raw) {
  const category = raw.category || 'strength';
  const mechanic = raw.mechanic || 'compound';

  switch (category) {
    case 'cardio':
      return 8.5;
    case 'plyometrics':
      return 8.0;
    case 'strongman':
      return 7.0;
    case 'olympic weightlifting':
      return 6.5;
    case 'powerlifting':
      return 6.0;
    case 'stretching':
      return 2.5;
    case 'strength':
    default:
      return mechanic === 'compound' ? 5.5 : 4.0;
  }
}

function deriveBodyZone(raw) {
  if (raw.category === 'cardio') return 'cardio';
  const primary = raw.primaryMuscles?.[0];
  if (primary && MUSCLE_TO_ZONE[primary]) {
    return MUSCLE_TO_ZONE[primary];
  }
  return 'core';
}

async function ensureRawDataset() {
  if (fs.existsSync(RAW_PATH)) {
    return JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  }
  console.log(`Downloading dataset from ${SOURCE_URL}...`);
  const res = await fetch(SOURCE_URL);
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`);
  const data = await res.json();
  fs.mkdirSync(path.dirname(RAW_PATH), { recursive: true });
  fs.writeFileSync(RAW_PATH, JSON.stringify(data, null, 2));
  return data;
}

async function main() {
  const rawList = await ensureRawDataset();

  const exercises = rawList.map((raw) => {
    const equipmentKey = raw.equipment || 'none';
    const primaryMuscleKey = raw.primaryMuscles?.[0] || 'abdominals';
    const bodyZone = deriveBodyZone(raw);
    const nameEs = translateExerciseName(raw.name);

    return {
      id: raw.id,
      name: nameEs,
      nameEn: raw.name,
      bodyZone,
      bodyZoneLabel: ZONE_LABELS_ES[bodyZone] || 'General',
      primaryMuscle: primaryMuscleKey,
      primaryMuscleLabel: MUSCLE_ES[primaryMuscleKey] || primaryMuscleKey,
      secondaryMuscles: (raw.secondaryMuscles || []).map((m) => ({
        key: m,
        label: MUSCLE_ES[m] || m,
      })),
      equipment: equipmentKey,
      equipmentLabel: EQUIPMENT_ES[equipmentKey] || equipmentKey,
      category: raw.category || 'strength',
      categoryLabel: CATEGORY_ES[raw.category] || 'Fuerza',
      level: raw.level || 'intermediate',
      levelLabel: LEVEL_ES[raw.level] || 'Intermedio',
      force: raw.force || null,
      forceLabel: raw.force ? FORCE_ES[raw.force] || raw.force : null,
      mechanic: raw.mechanic || null,
      mechanicLabel: raw.mechanic ? MECHANIC_ES[raw.mechanic] || raw.mechanic : null,
      metValue: computeMetValue(raw),
      images: Array.isArray(raw.images) ? raw.images : [],
      instructions: Array.isArray(raw.instructions) ? raw.instructions : [],
    };
  });

  // Ordenar por relevancia: compuestos conocidos primero, luego alfabético
  exercises.sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const version = `free-exercise-db-es-${exercises.length}-v1`;

  // Facetas precalculadas
  const countBy = (arr, keyFn, labelFn) => {
    const map = new Map();
    for (const item of arr) {
      const k = keyFn(item);
      if (!k) continue;
      const existing = map.get(k);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(k, { key: k, label: labelFn(item), count: 1 });
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  };

  const facets = {
    bodyZones: countBy(exercises, (e) => e.bodyZone, (e) => e.bodyZoneLabel),
    muscles: countBy(exercises, (e) => e.primaryMuscle, (e) => e.primaryMuscleLabel),
    equipment: countBy(exercises, (e) => e.equipment, (e) => e.equipmentLabel),
    categories: countBy(exercises, (e) => e.category, (e) => e.categoryLabel),
    levels: countBy(exercises, (e) => e.level, (e) => e.levelLabel),
  };

  const payload = {
    version,
    total: exercises.length,
    generatedAt: new Date().toISOString(),
    imageBaseUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises',
    facets,
    exercises,
  };

  // 1. Worker bundle data (compact JSON)
  const workerDataDir = path.join(ROOT, 'src/data');
  fs.mkdirSync(workerDataDir, { recursive: true });
  const compactJson = JSON.stringify(payload);
  fs.writeFileSync(path.join(workerDataDir, 'catalog.json'), compactJson);

  // 2. R2 artifact copy
  fs.writeFileSync(path.join(ROOT, 'data/exercises.es.json'), compactJson);

  // 3. Frontend static fallback copy (zero Vercel Function invocations in preview/offline)
  const frontendPublicDir = path.join(REPO_ROOT, 'apps/frontend/public/data');
  fs.mkdirSync(frontendPublicDir, { recursive: true });
  fs.writeFileSync(path.join(frontendPublicDir, 'exercises.es.json'), compactJson);

  const sizeKb = Math.round(Buffer.byteLength(compactJson, 'utf8') / 1024);
  console.log(`✅ Built catalog "${version}" with ${exercises.length} exercises (${sizeKb} KB uncompressed).`);
  console.log('   - services/exercise-api/src/data/catalog.json');
  console.log('   - services/exercise-api/data/exercises.es.json');
  console.log('   - apps/frontend/public/data/exercises.es.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
