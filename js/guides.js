// Guías: modos, proveedores de contenido y guardado local.
// HOY: solo el proveedor "demo". MAÑANA: registra otro con registerProvider()
// que llame a tu backend (ver README) y actívalo con setActiveProvider().
import { getState, update, newId, bumpLog } from './storage.js';

export const GUIDE_MODES = [
  { id: 'complete', label: 'Completa', icon: '📖', desc: 'Explicación a fondo del tema.' },
  { id: 'slides', label: 'Diapositiva por diapositiva', icon: '🖼️', desc: 'Sigue tu PPT en orden.' },
  { id: 'quick', label: 'Repaso rápido', icon: '⚡', desc: 'Para repasar en 5 minutos.' },
  { id: 'keypoints', label: 'Puntos clave', icon: '🔑', desc: 'Lo esencial en viñetas.' },
  { id: 'traps', label: 'Trampas', icon: '🪤', desc: 'Errores y confusiones típicas.' },
  { id: 'questions', label: 'Preguntas', icon: '❓', desc: 'Test tipo opción múltiple.' },
  { id: 'clinical', label: 'Casos clínicos', icon: '🩺', desc: 'Caso con preguntas y resolución.' }
];
export const modeInfo = (id) => GUIDE_MODES.find((m) => m.id === id) ?? GUIDE_MODES[0];

export const DEPTHS = [
  { id: 'basic', label: 'Básico' },
  { id: 'intermediate', label: 'Intermedio' },
  { id: 'advanced', label: 'Avanzado' }
];

export const STUDY_PRESETS = [
  {
    id: 'general', label: 'General', icon: '📚',
    desc: 'Una guía equilibrada para cualquier asignatura.',
    sections: ['Panorama general', 'Conceptos clave', 'Mecanismos', 'Aplicación', 'Resumen final']
  },
  {
    id: 'interna', label: 'Medicina Interna', icon: '🩺',
    desc: 'De la fisiopatología a la conducta clínica.',
    sections: ['Mapa general', 'Fisiopatología', 'Clínica por mecanismos', 'Exámenes: qué / para qué / qué cambia', 'Tratamiento', 'Seguimiento y derivación', 'Defensa de repreguntas']
  },
  {
    id: 'fisiologia', label: 'Fisiología', icon: '🫀',
    desc: 'Entender mecanismos, regulación e integración.',
    sections: ['Concepto central', 'Mecanismo paso a paso', 'Regulación y variables', 'Gráficos / relaciones', 'Integración clínica', 'Errores frecuentes']
  },
  {
    id: 'patologia', label: 'Patología', icon: '🔬',
    desc: 'Mecanismo + morfología + correlación clínica.',
    sections: ['Definición y mecanismo', 'Etiología', 'Patogenia', 'Morfología macroscópica', 'Morfología microscópica', 'Correlación clínica', 'Trampas y diferenciales']
  },
  {
    id: 'farmacologia', label: 'Farmacología', icon: '💊',
    desc: 'Ordena mecanismo, uso seguro y datos de examen.',
    sections: ['Mecanismo de acción', 'Indicaciones', 'Dosis / vía / intervalo', 'Farmacocinética', 'Efectos adversos', 'Contraindicaciones', 'Interacciones', 'Perlas de examen']
  }
];

export const presetInfo = (id) => STUDY_PRESETS.find((p) => p.id === id) ?? STUDY_PRESETS[0];

/* ---------- Proveedores ----------
 * Contrato: { id, label, generate(request) -> Promise<{ title, content }> }
 * request = { mode, depth, options:{mnemonics,summary}, subject, unit, lesson, files:[{name,type}] }
 * `content` es Markdown sencillo (#, -, 1., **negrita**, > cita).
 */
const providers = new Map();
let activeId = 'demo';
export const registerProvider = (p) => providers.set(p.id, p);
export const setActiveProvider = (id) => { if (providers.has(id)) activeId = id; };
export const getActiveProvider = () => providers.get(activeId);
export const generateGuide = (request) => getActiveProvider().generate(request);

/* ---------- Proveedor demo (sin IA) ---------- */
const NOTE = '> 🧪 Contenido de demostración, generado sin IA. Cuando conectes un proveedor, aquí aparecerá contenido real basado en tus archivos.';

const builders = {
  complete: ({ topic, depth, options: o, preset }) => {
    const route = (preset?.sections ?? presetInfo('general').sections)
      .map((section, i) => `${i + 1}. **${section}** — aquí irá el desarrollo específico basado en tus fuentes.`);
    return [
      `# Guía completa: ${topic}`, NOTE,
      `> 🐾 **Preset:** ${preset?.icon ?? '📚'} ${preset?.label ?? 'General'} · nivel ${depth}.`,
      '## Ruta de estudio',
      ...route,
      '## Cómo se verá con IA',
      'Study Paws usará esta estructura para integrar tus fuentes respetando su prioridad y el énfasis de la clase.',
      ...(o.mnemonics ? ['## Mnemotecnia', '> 🐾 Aquí aparecerán mnemotecnias solo cuando aporten al aprendizaje.'] : []),
      ...(o.summary ? ['## Resumen final', '- Idea central en una frase.', '- Dato que más cae en examen.', '- Punto que conviene repreguntar.'] : [])
    ];
  },

  slides: ({ topic, files }) => {
    const ppts = files.filter((f) => f.type === 'ppt');
    const titles = ['Introducción y objetivos', 'Definiciones clave', 'Mecanismo / fisiopatología', 'Manifestaciones clínicas', 'Diagnóstico y tratamiento', 'Resumen y preguntas'];
    return [
      `# Diapositiva por diapositiva: ${topic}`, NOTE,
      ppts.length ? `Basado en: ${ppts.map((f) => f.name).join(', ')}` : 'No hay PPT adjunto: se usan diapositivas de ejemplo.',
      ...titles.flatMap((t, i) => [
        `## Diapositiva ${i + 1}: ${t}`,
        '- Qué dice la diapositiva (resumen).',
        '- Cómo explicarlo con tus palabras.',
        '- Ojo: detalle que suele preguntarse.'
      ])
    ];
  },

  quick: ({ topic }) => [
    `# Repaso rápido: ${topic}`, NOTE,
    '## En 5 minutos',
    '1. Qué es y por qué importa.',
    '2. Los 3 datos que no pueden faltar.',
    '3. Cómo se diagnostica.',
    '4. Cómo se trata.',
    '5. Una complicación clásica.',
    '## Autotest relámpago',
    '- ¿Puedes explicar el tema sin mirar?',
    '- ¿Qué lo diferencia de su "gemelo" más parecido?'
  ],

  keypoints: ({ topic }) => [
    `# Puntos clave: ${topic}`, NOTE,
    '- 🔑 **Concepto central:** definición en una línea.',
    '- 🔑 **Causa / mecanismo principal.**',
    '- 🔑 **Presentación típica.**',
    '- 🔑 **Prueba diagnóstica de elección.**',
    '- 🔑 **Tratamiento de primera línea.**',
    '- 🔑 **Dato de examen.**'
  ],

  traps: ({ topic }) => [
    `# Trampas frecuentes: ${topic}`, NOTE,
    '## ⚠️ Confusión 1',
    'Dos conceptos parecidos que se mezclan. Aquí iría cómo distinguirlos.',
    '## ⚠️ Confusión 2',
    'Una excepción a la regla general que los profesores aman preguntar.',
    '## ⚠️ Confusión 3',
    'Un valor, dosis o clasificación que se memoriza mal.',
    '## Cómo evitarlas',
    '- Haz un cuadro comparativo.',
    '- Aprende la excepción junto a la regla.'
  ],

  questions: ({ topic }) => [
    `# Preguntas de práctica: ${topic}`, NOTE,
    ...[1, 2, 3, 4, 5].flatMap((n) => [
      `## Pregunta ${n}`,
      `¿Cuál de las siguientes afirmaciones sobre ${topic} es correcta?`,
      '- A) Opción de ejemplo A',
      '- B) Opción de ejemplo B',
      '- C) Opción de ejemplo C',
      '- D) Opción de ejemplo D',
      `**Respuesta:** ${'ABCD'[n % 4]}. Aquí iría la explicación de por qué es correcta y por qué las demás no.`
    ])
  ],

  clinical: ({ topic }) => [
    `# Caso clínico: ${topic}`, NOTE,
    '## Presentación',
    'Paciente de 45 años que acude por un cuadro de varios días de evolución. Antecedentes y exploración física de ejemplo.',
    '## Datos complementarios',
    '- Laboratorio: resultados de ejemplo.',
    '- Imagen: hallazgos de ejemplo.',
    '## Preguntas',
    '1. ¿Cuál es el diagnóstico más probable?',
    '2. ¿Qué mecanismo explica los síntomas?',
    '3. ¿Cuál es el siguiente paso?',
    '## Resolución',
    '**Diagnóstico:** explicación de ejemplo. **Manejo:** pasos de ejemplo.'
  ]
};

registerProvider({
  id: 'demo',
  label: 'Demo (sin IA)',
  async generate(req) {
    await new Promise((r) => setTimeout(r, 600)); // simula latencia
    const topic = req.lesson?.name ?? req.unit?.name ?? req.subject.name;
    const depth = DEPTHS.find((d) => d.id === req.depth)?.label.toLowerCase() ?? 'intermedio';
    const content = builders[req.mode]({ topic, depth, options: req.options, files: req.files, preset: presetInfo(req.preset) }).join('\n\n');
    return { title: `${modeInfo(req.mode).label} · ${topic}`, content };
  }
});

/* ---------- Guardado local ---------- */
export const listGuides = () => getState().guides;
export const findGuide = (id) => listGuides().find((g) => g.id === id);

export function saveGuide({ title, content, mode, subjectId, unitId = '', lessonId = '', status = 'draft' }) {
  const id = newId();
  const now = Date.now();
  update((s) => {
    s.guides.unshift({ id, title, content, mode, subjectId, unitId, lessonId, status, createdAt: now, updatedAt: now });
    bumpLog(s);
  });
  return id;
}
export function updateGuide(id, patch) {
  update(() => { const g = findGuide(id); if (g) Object.assign(g, patch, { updatedAt: Date.now() }); });
}
export function deleteGuide(id) {
  update((s) => { s.guides = s.guides.filter((g) => g.id !== id); });
}
