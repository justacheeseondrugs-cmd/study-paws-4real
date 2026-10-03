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
    id: 'interna_materia',
    label: 'Medicina Interna · Materia',
    icon: '🫀',
    desc: 'Para certámenes: entender, integrar y defender el tema.',
    sections: [
      'Mapa general del tema',
      'Fisiología y fisiopatología',
      'Clínica explicada por mecanismos',
      'Exámenes: qué pedir / para qué / qué cambia',
      'Diagnóstico y diferenciales',
      'Tratamiento: primera línea, dosis, vía e intervalo',
      'Efectos adversos y contraindicaciones relevantes',
      'Seguimiento y criterios de derivación',
      'Trampas de certamen',
      'Defensa de repreguntas'
    ]
  },
  {
    id: 'interna_practica',
    label: 'Medicina Interna · Práctica',
    icon: '🩺',
    desc: 'Para enfrentar pacientes, casos, ECG y preguntas del tutor.',
    sections: [
      'Problema clínico principal',
      'Qué preguntar en la anamnesis',
      'Qué buscar en el examen físico',
      'Diagnósticos diferenciales prioritarios',
      'Exámenes iniciales y cómo interpretarlos',
      'Conducta inmediata',
      'Tratamiento y monitorización',
      'Signos de alarma',
      'Qué podría preguntarme el tutor',
      'Mini caso para practicar'
    ]
  },
  {
    id: 'farmacologia',
    label: 'Farmacología',
    icon: '💊',
    desc: 'Mecanismo, indicación, seguridad y uso clínico.',
    sections: [
      'Grupo farmacológico y mecanismo de acción',
      'Indicaciones clínicas',
      'Dosis / vía / intervalo',
      'Inicio y duración de efecto',
      'Farmacocinética y metabolismo',
      'Efectos adversos',
      'Contraindicaciones y precauciones',
      'Interacciones importantes',
      'Comparación con fármacos similares',
      'Perlas y trampas de certamen'
    ]
  }
]

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
    const route = (preset?.sections ?? presetInfo('interna_materia').sections)
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
    const slideSources = files.filter((f) => ['ppt', 'pdf'].includes(f.type));
    const textSources = files.filter((f) => f.text?.trim());
    const paged = textSources.find((f) => /\[\[STUDY_PAWS_PAGE:\d+\]\]/.test(f.text));

    if (paged) {
      const parts = paged.text.split(/\[\[STUDY_PAWS_PAGE:(\d+)\]\]/).slice(1);
      const pages = [];
      for (let i = 0; i < parts.length; i += 2) {
        pages.push({ number: Number(parts[i]), text: (parts[i + 1] || '').trim() });
      }
      return [
        `# Diapositiva por diapositiva: ${topic}`,
        '> 🧠 Study Paws está usando el texto REAL extraído de tu PDF. Todavía falta conectar la IA para transformar cada página en una explicación médica completa.',
        `**Fuente:** ${paged.name} · ${pages.length} página(s) detectadas`,
        ...pages.flatMap((p) => [
          `## Diapositiva ${p.number}`,
          p.text || '*Sin texto extraíble en esta página.*',
          '### Próxima capa con IA',
          '- ¿Qué quiere enseñar esta diapositiva?',
          '- Explicación integrada con nivel de Medicina.',
          '- Fisiopatología / farmacología cuando corresponda.',
          '- Punto clave, trampa y posible pregunta del profesor.'
        ])
      ];
    }

    if (textSources.length) {
      const source = textSources[0];
      const paras = source.text.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
      const blockSize = Math.max(1, Math.ceil(paras.length / 6));
      const blocks = [];
      for (let i = 0; i < paras.length; i += blockSize) blocks.push(paras.slice(i, i + blockSize).join('\n\n'));
      return [
        `# Guía por bloques: ${topic}`,
        '> 🧠 Study Paws está usando texto REAL extraído de tu documento.',
        `**Fuente leída:** ${source.name} · ${source.text.length.toLocaleString('es-CL')} caracteres`,
        ...blocks.slice(0, 6).flatMap((block, i) => [`## Bloque ${i + 1}`, block.slice(0, 1800)])
      ];
    }

    return [
      `# Diapositiva por diapositiva: ${topic}`, NOTE,
      slideSources.length
        ? `Fuente detectada: ${slideSources.map((f) => f.name).join(', ')}. Usa 🧠 Leer para extraer su contenido.`
        : 'No hay una fuente legible todavía. Adjunta un PDF o DOCX y usa 🧠 Leer.',
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
