// Punto de entrada: tema, router y vistas.
import { getState, subscribe, update, updateSilent, exportData, importData, resetAll, dayKey } from './storage.js';
import {
  getSubjects, findSubject, findUnit, findLesson, lessonsOf, subjectStats, allStats,
  addSubject, renameSubject, deleteSubject, addUnit, renameUnit, deleteUnit,
  addLesson, renameLesson, deleteLesson, toggleLessonDone
} from './subjects.js';
import { FILE_TYPES, typeInfo, attachFiles, setFileType, setSourceUse, removeFile, openFile, formatSize, extractAndStoreText, openExtractedText, buildSourcePayload, ensureLessonIndexes, buildLessonAlignments, getLessonAlignments } from './files.js';
import { detectMaterialPairs, buildSlideGenerationBlocks } from './smart-class.js';
import { inspectContext, contextToMarkdown } from './context-inspector.js';
import { isAiConfigured, getBackendAccessToken, setBackendAccessToken, testAiBackend } from './ai-client.js';
import { runPreparedGeneration, resumeGeneration } from './ai-runner.js';
import { SOURCE_USE, sourceUseInfo } from './source-policy.js';
import { KNOWLEDGE_DIMENSIONS, getKnowledgeState, setKnowledgeDimension, averageKnowledge } from './knowledge-state.js';
import { BRAIN_VERSION, inferPresetForSubject } from './brain.js';
import { buildContextPlan } from './context-planner.js';
import {
  GUIDE_MODES, DEPTHS, STUDY_PRESETS, presetInfo, modeInfo, generateGuide, saveGuide, updateGuide, deleteGuide, findGuide, listGuides
} from './guides.js';
import { h, md, toast, promptDialog, confirmDialog, catSvg } from './ui.js';

const app = document.getElementById('app');
const go = (hash) => { location.hash = hash; };
const fmtDate = (ts) => new Date(ts).toLocaleDateString('es', { day: 'numeric', month: 'short' });

/* ================= Tema ================= */
const mq = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = getState().settings.theme;
  const dark = pref === 'dark' || (pref === 'auto' && mq.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#1d1820' : '#fbf4e6';
  document.getElementById('theme-toggle').textContent = dark ? '☀️' : '🌙';
}
const setTheme = (t) => update((s) => { s.settings.theme = t; });
mq.addEventListener('change', applyTheme);
document.getElementById('theme-toggle').addEventListener('click', () =>
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

/* ================= Piezas comunes ================= */
const iconBtn = (icon, label, onClick) => h('button', { class: 'icon-btn', type: 'button', title: label, 'aria-label': label, onClick }, icon);
const progressBar = (pct) => h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: `width:${pct}%` }));
const emptyState = (title, text, action) =>
  h('div', { class: 'empty' }, h('div', { class: 'cat-wrap', html: catSvg() }), h('h3', {}, title), h('p', { class: 'muted' }, text), action);
const crumbs = (...items) =>
  h('nav', { class: 'crumbs', 'aria-label': 'Ruta' }, items.map((it, i) => [i ? ' › ' : '', it.href ? h('a', { href: it.href }, it.label) : it.label]));
const notFound = () => emptyState('No encontramos esto', 'Puede que se haya eliminado.', h('a', { class: 'btn', href: '#/' }, 'Volver al inicio'));

/* ================= Acciones (diálogos) ================= */
async function onAddSubject() {
  const name = await promptDialog({ title: 'Nueva materia', label: 'Ej. Anatomía' });
  if (name) { addSubject(name); toast('Materia creada 🐾'); }
}
async function onRenameSubject(s) {
  const name = await promptDialog({ title: 'Renombrar materia', label: 'Nombre', value: s.name });
  if (name) renameSubject(s.id, name);
}
async function onDeleteSubject(s, redirect) {
  const ok = await confirmDialog({ title: `¿Eliminar "${s.name}"?`, text: 'Se borrarán sus unidades, clases, archivos y guías. No se puede deshacer.', confirm: 'Eliminar', danger: true });
  if (!ok) return;
  if (redirect) go('#/');
  await deleteSubject(s.id);
  toast('Materia eliminada');
}
async function onAddUnit(s) {
  const name = await promptDialog({ title: 'Nueva unidad', label: 'Ej. Unidad 1: Cabeza y cuello' });
  if (name) addUnit(s.id, name);
}
async function onRenameUnit(s, u) {
  const name = await promptDialog({ title: 'Renombrar unidad', label: 'Nombre', value: u.name });
  if (name) renameUnit(s.id, u.id, name);
}
async function onDeleteUnit(s, u) {
  const ok = await confirmDialog({ title: `¿Eliminar "${u.name}"?`, text: 'Se borrarán sus clases y archivos. Las guías guardadas se conservan.', confirm: 'Eliminar', danger: true });
  if (ok) await deleteUnit(s.id, u.id);
}
async function onAddLesson(s, u) {
  const name = await promptDialog({ title: 'Nueva clase', label: 'Ej. Clase 3: Nervios craneales' });
  if (name) addLesson(s.id, u.id, name);
}
async function onRenameLesson(s, u, l) {
  const name = await promptDialog({ title: 'Renombrar clase', label: 'Nombre', value: l.name });
  if (name) renameLesson(s.id, u.id, l.id, name);
}
async function onDeleteLesson(s, u, l, redirect) {
  const ok = await confirmDialog({ title: `¿Eliminar "${l.name}"?`, text: 'Se borrarán sus archivos. Las guías guardadas se conservan.', confirm: 'Eliminar', danger: true });
  if (!ok) return;
  if (redirect) go(`#/subject/${s.id}`);
  await deleteLesson(s.id, u.id, l.id);
}

/* ================= Vistas ================= */
function homeView() {
  const subs = getSubjects();
  const st = allStats();
  return h('section', { class: 'view' },
    h('div', { class: 'card hero' },
      h('div', { class: 'hero-cat', html: catSvg() }),
      h('div', {},
        h('h1', {}, 'Study Paws'),
        h('p', { class: 'muted' }, subs.length
          ? `Llevas ${st.done} de ${st.total} clases estudiadas. ¡Miau, sigue así!`
          : 'Miau 🐾 Crea tu primera materia y empecemos a estudiar.'))),
    h('div', { class: 'row between' },
      h('h2', {}, 'Mis materias'),
      h('button', { class: 'btn', onClick: onAddSubject }, '+ Nueva materia')),
    subs.length
      ? h('div', { class: 'grid' }, subs.map(subjectCard))
      : emptyState('Aún no hay materias', 'Ejemplos: Anatomía, Fisiología, Farmacología…'));
}

function subjectCard(s) {
  const st = subjectStats(s);
  return h('article', { class: `card subject c${s.color}` },
    h('a', { class: 'card-link', href: `#/subject/${s.id}` },
      h('span', { class: 'emoji' }, s.emoji),
      h('h3', {}, s.name),
      h('p', { class: 'muted' }, `${s.units.length} unidades · ${st.total} clases`),
      progressBar(st.pct)),
    h('div', { class: 'card-actions' },
      iconBtn('✏️', 'Renombrar', () => onRenameSubject(s)),
      iconBtn('🗑️', 'Eliminar', () => onDeleteSubject(s))));
}

function subjectView(sid) {
  const s = findSubject(sid);
  if (!s) return notFound();
  const st = subjectStats(s);
  return h('section', { class: 'view' },
    crumbs({ label: 'Materias', href: '#/' }, { label: s.name }),
    h('div', { class: `card subject-head c${s.color}` },
      h('span', { class: 'emoji big' }, s.emoji),
      h('div', { class: 'grow' },
        h('h1', {}, s.name),
        h('p', { class: 'muted' }, `${st.done}/${st.total} clases estudiadas`),
        progressBar(st.pct)),
      h('div', { class: 'card-actions' },
        iconBtn('✏️', 'Renombrar', () => onRenameSubject(s)),
        iconBtn('🗑️', 'Eliminar', () => onDeleteSubject(s, true)))),
    h('div', { class: 'row between' },
      h('h2', {}, 'Unidades'),
      h('button', { class: 'btn', onClick: () => onAddUnit(s) }, '+ Unidad')),
    s.units.length
      ? s.units.map((u) => unitCard(s, u))
      : emptyState('Sin unidades todavía', 'Crea una unidad y luego añade sus clases.'),
    h('a', { class: 'btn ghost', href: `#/create?s=${s.id}` }, '✨ Crear guía de esta materia'));
}

function unitCard(s, u) {
  return h('article', { class: 'card' },
    h('div', { class: 'unit-head' },
      h('h3', { class: 'grow' }, `📖 ${u.name}`),
      iconBtn('✏️', 'Renombrar unidad', () => onRenameUnit(s, u)),
      iconBtn('🗑️', 'Eliminar unidad', () => onDeleteUnit(s, u))),
    u.lessons.length
      ? h('ul', { class: 'lessons' }, u.lessons.map((l) =>
        h('li', { class: `lesson${l.done ? ' done' : ''}` },
          h('input', { type: 'checkbox', checked: l.done, 'aria-label': `Marcar "${l.name}" como estudiada`, onChange: () => toggleLessonDone(s.id, u.id, l.id) }),
          h('a', { href: `#/lesson/${s.id}/${u.id}/${l.id}` }, l.name),
          l.files.length ? h('span', { class: 'badge' }, `📎 ${l.files.length}`) : null,
          iconBtn('✏️', 'Renombrar clase', () => onRenameLesson(s, u, l)),
          iconBtn('🗑️', 'Eliminar clase', () => onDeleteLesson(s, u, l)))))
      : h('p', { class: 'muted' }, 'Sin clases aún.'),
    h('button', { class: 'btn ghost small', onClick: () => onAddLesson(s, u) }, '+ Clase'));
}

function knowledgeCard(sid, unitId, lessonId) {
  const state = getKnowledgeState(sid, unitId, lessonId);
  return h('div', { class: 'card form-grid knowledge-card' },
    h('div', {},
      h('h2', {}, '🧠 Estado de aprendizaje'),
      h('p', { class: 'muted' }, 'Comprender no es lo mismo que recordar, aplicar o defender. Más adelante Study Paws actualizará esto con tus resultados.')),
    KNOWLEDGE_DIMENSIONS.map((d) =>
      h('div', { class: 'knowledge-row' },
        h('span', { class: 'knowledge-label' }, `${d.icon} ${d.label}`),
        h('div', { class: 'knowledge-dots', role: 'group', 'aria-label': d.label },
          [0,1,2,3,4].map((n) =>
            h('button', {
              type: 'button',
              class: `knowledge-dot${state[d.id] === n ? ' on' : ''}`,
              title: n === 0 ? 'Sin evaluar' : `${n}/4`,
              'aria-label': `${d.label}: ${n} de 4`,
              onClick: () => setKnowledgeDimension(sid, unitId, lessonId, d.id, n)
            }, n === 0 ? '·' : String(n)))))));
}

function smartClassCard(sid, unitId, lessonId, lesson) {
  const pairs = detectMaterialPairs(lesson.files || []);
  const ready = (lesson.files || []).filter((f) => f.textStatus === 'ready' && f.sourceUse !== 'exclude');
  const indexed = ready.filter((f) => f.indexStatus === 'ready');
  const pairRows = pairs.map((p) =>
    h('li', {}, `📊 ${p.slideName} ↔ 🎙️ ${p.transcriptName} · confianza ${p.confidence}`));

  const alignmentStatus = h('div', { class: 'muted' }, pairs.length ? 'Alineaciones todavía no preparadas.' : '');
  const alignmentMap = h('div', { class: 'alignment-map-slot' });

  function renderAlignmentMap(saved) {
    if (!saved.length) {
      alignmentMap.replaceChildren();
      return;
    }
    alignmentMap.replaceChildren(
      h('details', { class: 'alignment-details' },
        h('summary', {}, '👁️ Ver mapa diapositiva ↔ transcripción'),
        saved.map((a) =>
          h('div', { class: 'alignment-pair' },
            h('strong', {}, `${a.slideName} ↔ ${a.transcriptName}`),
            h('div', { class: 'alignment-list' },
              (a.items || []).map((item) =>
                h('div', { class: 'alignment-row' },
                  h('span', { class: 'alignment-slide' }, `Diapo ${item.page}`),
                  h('div', { class: 'alignment-matches' },
                    (item.transcriptMatches || []).length
                      ? (item.transcriptMatches || []).map((m) =>
                          h('div', { class: `alignment-match ${m.confidence || 'baja'}` },
                            h('b', {}, `🎙️ Fragmento ${m.chunk} · ${m.confidence || 'baja'}`),
                            h('span', {}, String(m.text || '').slice(0, 180) + (String(m.text || '').length > 180 ? '…' : ''))))
                      : h('span', { class: 'muted' }, 'Sin coincidencia útil')))))))));
  }

  getLessonAlignments(pairs).then((saved) => {
    if (!pairs.length) return;
    const pages = saved.reduce((n,a)=>n+(a.items?.length||0),0);
    const strong = saved.reduce((n,a)=>n+(a.items||[]).reduce((m,item)=>m+(item.transcriptMatches||[]).filter(x=>x.confidence==='alta'||x.confidence==='media').length,0),0);
    alignmentStatus.textContent = saved.length
      ? `🔗 ${saved.length}/${pairs.length} pareja(s) alineadas · ${pages} diapositivas mapeadas · ${strong} vínculos útiles`
      : '🔗 Alineación profunda pendiente.';
    renderAlignmentMap(saved);
  }).catch(()=>{});

  const prepareBtn = h('button', { class: 'btn ghost small', type: 'button' }, '🧩 Preparar clase');
  prepareBtn.addEventListener('click', async () => {
    if (!ready.length) return toast('Primero usa 🧠 Leer en al menos un documento');
    prepareBtn.disabled = true;
    prepareBtn.textContent = '🐾 Indexando…';
    try {
      const indexes = await ensureLessonIndexes(sid, unitId, lessonId, lesson.files || []);
      toast(`Clase preparada: ${indexes.length} fuente(s) indexadas 🧩`);
    } catch (e) {
      toast(e.message || 'No se pudo preparar la clase');
    } finally {
      prepareBtn.disabled = false;
      prepareBtn.textContent = '🧩 Preparar clase';
    }
  });

  const alignBtn = h('button', { class: 'btn ghost small', type: 'button' }, '🔗 Alinear PPT + transcripción');
  alignBtn.disabled = !pairs.length;
  alignBtn.addEventListener('click', async () => {
    if (!pairs.length) return toast('No detecté una pareja presentación + transcripción');
    const unread = pairs.some((p) => {
      const a = lesson.files.find((f) => f.id === p.slideId);
      const b = lesson.files.find((f) => f.id === p.transcriptId);
      return a?.textStatus !== 'ready' || b?.textStatus !== 'ready';
    });
    if (unread) return toast('Primero usa 🧠 Leer en la presentación y la transcripción');

    alignBtn.disabled = true;
    alignBtn.textContent = '🐾 Alineando…';
    try {
      await ensureLessonIndexes(sid, unitId, lessonId, lesson.files || []);
      const aligned = await buildLessonAlignments(sid, unitId, lessonId, pairs);
      const pages = aligned.reduce((n,a)=>n+(a.items?.length||0),0);
      const useful = aligned.reduce((n,a)=>n+(a.items||[]).reduce((m,item)=>m+(item.transcriptMatches||[]).filter(x=>x.confidence==='alta'||x.confidence==='media').length,0),0);
      alignmentStatus.textContent = `🔗 ${aligned.length}/${pairs.length} pareja(s) alineadas · ${pages} diapositivas mapeadas · ${useful} vínculos útiles`;
      renderAlignmentMap(aligned);
      toast(`Alineación lista: ${pages} diapositivas vinculadas con la transcripción 🔗`);
    } catch (e) {
      console.error(e);
      toast(e.message || 'No se pudo alinear la clase');
    } finally {
      alignBtn.disabled = !pairs.length;
      alignBtn.textContent = '🔗 Alinear PPT + transcripción';
    }
  });

  return h('div', { class: 'card form-grid smart-class-card' },
    h('div', {},
      h('h2', {}, '🧩 Smart Class'),
      h('p', { class: 'muted' }, 'Study Paws relaciona materiales de la misma clase y crea un índice local para recuperar solo lo relevante. No usa IA.')),
    h('div', { class: 'mini-stats' },
      h('div', { class: 'mini-stat' }, h('b', {}, ready.length), h('small', { class: 'muted' }, 'fuentes leídas')),
      h('div', { class: 'mini-stat' }, h('b', {}, indexed.length), h('small', { class: 'muted' }, 'indexadas')),
      h('div', { class: 'mini-stat' }, h('b', {}, pairs.length), h('small', { class: 'muted' }, 'parejas detectadas')),
      h('div', { class: 'mini-stat' }, h('b', {}, indexed.reduce((n,f)=>n+Number(f.chunkCount||0),0)), h('small', { class: 'muted' }, 'fragmentos'))),
    pairRows.length
      ? h('details', { open: true }, h('summary', {}, 'PPT/PDF + transcripción'), h('ul', { class: 'sources' }, pairRows))
      : h('p', { class: 'muted' }, 'Si adjuntas una presentación y su transcripción, intentaré vincularlas automáticamente.'),
    alignmentStatus,
    alignmentMap,
    h('div', { class: 'row gap wrap' }, prepareBtn, alignBtn));
}

function lessonView(sid, unitId, lessonId) {
  const s = findSubject(sid);
  const u = findUnit(sid, unitId);
  const l = findLesson(sid, unitId, lessonId);
  if (!l) return notFound();

  const typeSel = h('select', { 'aria-label': 'Tipo de archivo a adjuntar' },
    h('option', { value: 'auto' }, '✨ Detectar tipo automáticamente'),
    FILE_TYPES.map((t) => h('option', { value: t.id }, `${t.icon} ${t.label}`)));

  const handle = async (files) => {
    if (!files.length) return;
    const r = await attachFiles(sid, unitId, lessonId, files, typeSel.value);
    toast(r.failed.length ? `No se pudo guardar: ${r.failed.join(', ')}` : `${r.added} archivo(s) añadido(s) 📎`);
  };
  const input = h('input', { type: 'file', multiple: true, id: 'file-input', class: 'sr-only', onChange: (e) => { handle([...e.target.files]); e.target.value = ''; } });
  const zone = h('label', { class: 'dropzone', for: 'file-input' },
    h('span', { class: 'dz-icon' }, '📎'),
    h('strong', {}, 'Toca para adjuntar archivos'),
    h('small', { class: 'muted' }, 'o arrástralos aquí · se guardan solo en este dispositivo'));
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); handle([...e.dataTransfer.files]); });

  const guides = listGuides().filter((g) => g.lessonId === lessonId);

  return h('section', { class: 'view' },
    crumbs({ label: 'Materias', href: '#/' }, { label: s.name, href: `#/subject/${s.id}` }, { label: u.name }, { label: l.name }),
    h('div', { class: 'card' },
      h('h1', {}, l.name),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: l.done, onChange: () => toggleLessonDone(sid, unitId, lessonId) }),
        'Clase estudiada')),
    knowledgeCard(sid, unitId, lessonId),
    smartClassCard(sid, unitId, lessonId, l),
    h('h2', {}, 'Archivos de la clase'),
    h('div', { class: 'card form-grid' },
      h('label', { class: 'field' }, 'Clasificar como', typeSel),
      input, zone,
      l.files.length
        ? h('ul', { class: 'files' }, l.files.map((f) => fileRow(sid, unitId, lessonId, f)))
        : h('p', { class: 'muted' }, 'Aún no hay archivos: PPT, transcripciones, guías, libros…')),
    h('a', { class: 'btn', href: `#/create?s=${sid}&u=${unitId}&l=${lessonId}&p=${inferPresetForSubject(s.name)}` }, '✨ Crear guía con esta clase'),
    guides.length ? h('div', { class: 'view' }, h('h2', {}, 'Guías de esta clase'), guides.map(guideItem)) : null);
}

function fileRow(sid, unitId, lessonId, f) {
  const t = typeInfo(f.type);
  return h('li', { class: 'file' },
    h('span', { class: 'dz-icon', 'aria-hidden': 'true' }, t.icon),
    h('div', { class: 'fname' }, f.name,
      h('div', { class: 'muted', style: 'font-weight:400;font-size:.8rem' },
        `${formatSize(f.size)}${f.indexStatus === 'ready' ? ` · 🧩 ${f.chunkCount || 0} fragmentos` : ''}`)),
    h('div', { class: 'fmeta' },
      h('select', { 'aria-label': 'Tipo de archivo', onChange: (e) => setFileType(sid, unitId, lessonId, f.id, e.target.value) },
        FILE_TYPES.map((x) => h('option', { value: x.id, selected: x.id === f.type }, `${x.icon} ${x.label}`))),
      h('select', {
        class: 'source-use',
        'aria-label': 'Uso de esta fuente',
        title: f.sourceNote || 'Cómo debe usar Study Paws este documento',
        onChange: async (e) => {
          const value = e.target.value;
          let note = f.sourceNote || '';
          if (value === 'exclude') {
            note = await promptDialog({
              title: '¿Por qué no usar este documento?',
              label: 'Ej: está repetido / no entra / está desactualizado',
              value: note,
              confirm: 'Guardar decisión'
            }) || note;
          }
          setSourceUse(sid, unitId, lessonId, f.id, value, note);
        }
      }, SOURCE_USE.map((x) => h('option', { value: x.id, selected: x.id === (f.sourceUse || 'auto') }, x.label))),
      iconBtn('👁️', 'Abrir', () => openFile(f).catch(() => toast('No se pudo abrir el archivo'))),
      f.textStatus === 'ready'
        ? h('button', { class: 'btn ghost small file-read-btn', type: 'button',
            title: `Ver texto leído (${f.textChars || 0} caracteres)`,
            onClick: () => openExtractedText(f).catch((e) => toast(e.message))
          }, '🔎 Ver texto')
        : h('button', { class: 'btn ghost small file-read-btn', type: 'button',
            disabled: f.textStatus === 'reading',
            title: f.textStatus === 'error' ? (f.textError || 'Reintentar lectura') : 'Extraer texto del documento',
            onClick: async () => {
              try {
                const r = await extractAndStoreText(sid, unitId, lessonId, f.id);
                toast(`Documento leído: ${r.chars.toLocaleString('es-CL')} caracteres 🐾`);
              } catch (e) {
                toast(e.message || 'No se pudo leer el documento');
              }
            }
          }, f.textStatus === 'reading' ? '🐾 Leyendo…' : f.textStatus === 'error' ? '🧠 Reintentar' : '🧠 Leer'),
      iconBtn('🗑️', 'Quitar', async () => {
        if (await confirmDialog({ title: `¿Quitar "${f.name}"?`, confirm: 'Quitar', danger: true })) removeFile(sid, unitId, lessonId, f.id);
      })));
}

/* ---------- Crear guía ---------- */
function createView(query = '') {
  const q = new URLSearchParams(query);
  const subs = getSubjects();
  if (!subs.length) {
    return emptyState('Primero crea una materia', 'Las guías se generan a partir de una materia, unidad o clase.', h('a', { class: 'btn', href: '#/' }, 'Ir a materias'));
  }
  const form = {
    sid: findSubject(q.get('s')) ? q.get('s') : subs[0].id,
    unitId: q.get('u') || '', lessonId: q.get('l') || '',
    mode: GUIDE_MODES.some((m) => m.id === q.get('m')) ? q.get('m') : 'complete',
    preset: STUDY_PRESETS.some((p) => p.id === q.get('p')) ? q.get('p') : inferPresetForSubject(subs[0]?.name || ''),
    depth: 'intermediate', mnemonics: true, summary: true, focus: ''
  };
  if (!findUnit(form.sid, form.unitId)) { form.unitId = ''; form.lessonId = ''; }
  if (!findLesson(form.sid, form.unitId, form.lessonId)) form.lessonId = '';

  const subjectSel = h('select', { 'aria-label': 'Materia' });
  const unitSel = h('select', { 'aria-label': 'Unidad' });
  const lessonSel = h('select', { 'aria-label': 'Clase' });
  const sourcesBox = h('div', { class: 'muted' });
  const planBox = h('div', { class: 'brain-plan-body' });

  function fill() {
    const sub = findSubject(form.sid);
    const unit = sub.units.find((u) => u.id === form.unitId);
    subjectSel.replaceChildren(...subs.map((x) => h('option', { value: x.id, selected: x.id === form.sid }, `${x.emoji} ${x.name}`)));
    unitSel.replaceChildren(h('option', { value: '' }, '— Toda la materia —'),
      ...sub.units.map((u) => h('option', { value: u.id, selected: u.id === form.unitId }, u.name)));
    lessonSel.replaceChildren(h('option', { value: '' }, '— Toda la unidad —'),
      ...(unit ? unit.lessons : []).map((l) => h('option', { value: l.id, selected: l.id === form.lessonId }, l.name)));
    lessonSel.disabled = !unit;
    renderSources();
    renderPlan();
  }

  function renderPlan() {
    const subject = findSubject(form.sid);
    const unit = findUnit(form.sid, form.unitId);
    const lesson = findLesson(form.sid, form.unitId, form.lessonId);
    const plan = buildContextPlan({
      preset: form.preset,
      mode: form.mode,
      depth: form.depth,
      subject,
      unit,
      lesson,
      files: lesson?.files || []
    });

    const stat = (value, label) =>
      h('div', { class: 'mini-stat' }, h('b', {}, value), h('small', { class: 'muted' }, label));

    const sourceRows = plan.sources.map((src) =>
      h('li', {}, `${typeInfo(src.type).icon} ${src.name} · ${sourceUseInfo(src.sourceUse).label} · ${src.readable ? `~${Math.ceil((src.textChars || 0) / 4).toLocaleString('es-CL')} tok` : 'sin texto leído'}`));

    planBox.replaceChildren(
      h('div', { class: 'brain-plan-head' },
        h('strong', {}, `🐾 Brain ${plan.brainVersion} · ${plan.brainLabel}`),
        h('p', { class: 'muted' }, plan.chunkLabel)),
      h('div', { class: 'mini-stats' },
        stat(plan.readableSources, 'fuentes listas'),
        stat(plan.pages || '—', 'páginas'),
        stat(plan.estimatedInputTokens ? `~${plan.estimatedInputTokens.toLocaleString('es-CL')}` : '—', 'tokens entrada'),
        stat(plan.calls || '—', 'bloques IA')),
      sourceRows.length
        ? h('details', {}, h('summary', {}, 'Fuentes que priorizaría'), h('ul', { class: 'sources' }, sourceRows))
        : null,
      plan.warnings.length
        ? h('div', { class: 'plan-warnings' }, plan.warnings.map((w) => h('p', {}, `⚠️ ${w}`)))
        : null
    );
  }

  function renderSources() {
    const l = findLesson(form.sid, form.unitId, form.lessonId);
    if (!l) { sourcesBox.replaceChildren('Elige una clase para usar sus archivos como fuentes.'); return; }
    sourcesBox.replaceChildren(l.files.length
      ? h('div', {}, h('strong', {}, 'Fuentes de la clase:'), h('ul', { class: 'sources' }, l.files.map((f) =>
          h('li', {}, `${typeInfo(f.type).icon} ${f.name} ${f.textStatus === 'ready' ? `· 🧠 leído (${(f.textChars || 0).toLocaleString('es-CL')} caracteres)` : '· pendiente de lectura'}`))))
      : 'Esta clase no tiene archivos todavía; se usará contenido de ejemplo.');
  }
  subjectSel.addEventListener('change', () => { form.sid = subjectSel.value; form.unitId = ''; form.lessonId = ''; fill(); });
  unitSel.addEventListener('change', () => { form.unitId = unitSel.value; form.lessonId = ''; fill(); });
  lessonSel.addEventListener('change', () => { form.lessonId = lessonSel.value; renderSources(); renderPlan(); });

  const presetGrid = h('div', { class: 'preset-grid', role: 'radiogroup', 'aria-label': 'Preset de estudio' },
    STUDY_PRESETS.map((p) => h('label', { class: 'preset-chip' },
      h('input', { type: 'radio', name: 'preset', value: p.id, checked: p.id === form.preset, onChange: () => { form.preset = p.id; renderPlan(); } }),
      h('span', { class: 'preset-body' },
        h('span', { class: 'preset-icon' }, p.icon),
        h('span', {}, h('strong', {}, p.label), h('small', {}, p.desc))))));

    const modeGrid = h('div', { class: 'mode-grid', role: 'radiogroup', 'aria-label': 'Modo de guía' },
    GUIDE_MODES.map((m) => h('label', { class: 'mode-chip' },
      h('input', { type: 'radio', name: 'mode', value: m.id, checked: m.id === form.mode, onChange: () => { form.mode = m.id; renderPlan(); refreshAiButtons(); } }),
      h('span', { class: 'mode-body' }, h('span', { class: 'mode-icon' }, m.icon), h('strong', {}, m.label), h('small', {}, m.desc)))));

  const depthSel = h('select', { 'aria-label': 'Profundidad', onChange: (e) => { form.depth = e.target.value; renderPlan(); } },
    DEPTHS.map((d) => h('option', { value: d.id, selected: d.id === form.depth }, d.label)));
  const mnem = h('input', { type: 'checkbox', checked: true, onChange: (e) => { form.mnemonics = e.target.checked; } });
  const summ = h('input', { type: 'checkbox', checked: true, onChange: (e) => { form.summary = e.target.checked; } });
  const focusInput = h('input', {
    type: 'text',
    placeholder: 'Opcional: ej. resistencia diurética, IECA, betabloqueadores…',
    'aria-label': 'Enfoque o pregunta para recuperar contexto',
    onInput: (e) => { form.focus = e.target.value; }
  });

  const out = h('div', { class: 'view' });
  const aiReady = isAiConfigured();
  const btn = h('button', { class: 'btn', type: 'button' });
  const smokeBtn = h('button', { class: 'btn safe-test-btn', type: 'button' }, '🧪 Probar solo slides 1–5');
  const inspectBtn = h('button', { class: 'btn ghost', type: 'button' }, '👀 Ver contexto');

  function smokePassed() {
    return Boolean(getState().settings.aiSmokeTestPassed);
  }

  function refreshAiButtons() {
    const guarded = aiReady && form.mode === 'slides' && !smokePassed();
    btn.disabled = guarded;
    btn.textContent = !aiReady
      ? '✨ Generar guía (demo)'
      : guarded
        ? '🔒 Clase completa · aprueba primero la prueba'
        : '✨ Generar con IA';
    smokeBtn.hidden = !(aiReady && form.mode === 'slides');
    smokeBtn.textContent = smokePassed()
      ? '🧪 Repetir prueba slides 1–5'
      : '🧪 Probar solo slides 1–5';
  }
  refreshAiButtons();

  inspectBtn.addEventListener('click', async () => {
    const subject = findSubject(form.sid);
    const unit = findUnit(form.sid, form.unitId);
    const lesson = findLesson(form.sid, form.unitId, form.lessonId);
    if (!lesson) return toast('Elige una clase para inspeccionar su contexto');

    inspectBtn.disabled = true;
    inspectBtn.textContent = '🐾 Preparando contexto…';
    try {
      const indexes = await ensureLessonIndexes(form.sid, form.unitId, form.lessonId, lesson.files || []);
      const pairs = detectMaterialPairs(lesson.files || []);
      const alignments = await getLessonAlignments(pairs);
      const ctx = inspectContext({
        subject, unit, lesson,
        preset: form.preset, mode: form.mode, focus: form.focus,
        files: lesson.files || [], indexes, alignments
      });
      const markdown = contextToMarkdown(ctx, { brainLabel: presetInfo(form.preset).label });
      out.replaceChildren(h('div', { class: 'card form-grid context-inspector-card' },
        h('div', { class: 'row between wrap' },
          h('div', {}, h('h2', {}, '👀 Context Inspector'),
            h('p', { class: 'muted' }, 'Esto se calcula localmente. No usa API ni créditos.')),
          h('span', { class: 'badge' }, `~${ctx.estimatedTokens.toLocaleString('es-CL')} tokens seleccionados`)),
        h('article', { class: 'guide-paper inspector-paper', html: md(markdown) })));
      out.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      console.error(e);
      toast(e.message || 'No se pudo inspeccionar el contexto');
    } finally {
      inspectBtn.disabled = false;
      inspectBtn.textContent = '👀 Ver contexto';
    }
  });

  let currentController = null;
  let lastJobId = '';

  async function prepareAiBlocks(subject, unit, lesson) {
    const indexes = await ensureLessonIndexes(form.sid, form.unitId, form.lessonId, lesson.files || []);
    const pairs = detectMaterialPairs(lesson.files || []);
    let alignments = await getLessonAlignments(pairs);

    if (pairs.length && alignments.length < pairs.length) {
      const built = await buildLessonAlignments(form.sid, form.unitId, form.lessonId, pairs);
      if (built.length) alignments = built;
    }

    if (form.mode === 'slides') {
      const blocks = buildSlideGenerationBlocks({
        files: lesson.files || [],
        indexes,
        alignments,
        preset: form.preset,
        blockSize: 5
      });
      if (!blocks.length) throw new Error('No encontré un PDF indexado por diapositivas para generar por bloques.');
      return blocks;
    }

    const ctx = inspectContext({
      subject, unit, lesson,
      preset: form.preset, mode: form.mode, focus: form.focus,
      files: lesson.files || [], indexes, alignments
    });
    if (!ctx.selected?.length) throw new Error('No encontré contexto legible para enviar a la IA.');
    return [{ label: modeInfo(form.mode).label, focus: form.focus, smartContext: ctx }];
  }

  function renderAiProgress(info = {}) {
    const total = Number(info.total || 1);
    const index = Number(info.index || 0);
    const done = info.status === 'done' ? index + 1 : index;
    const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
    const statusText = info.status === 'error'
      ? `⚠️ Falló ${info.label || `bloque ${index + 1}`}`
      : info.status === 'done'
        ? `✅ ${info.label || `Bloque ${index + 1}`} guardado`
        : `🐾 Generando ${info.label || `bloque ${index + 1}`}…`;

    const stop = h('button', {
      class: 'btn ghost small',
      type: 'button',
      onClick: () => currentController?.abort()
    }, '⏸️ Detener');

    out.replaceChildren(h('div', { class: 'card form-grid ai-progress-card' },
      h('div', { class: 'row between wrap' },
        h('div', {}, h('h2', {}, '✨ Study Paws está escribiendo'), h('p', { class: 'muted' }, statusText)),
        h('span', { class: 'badge' }, `${Math.min(index + 1, total)}/${total}`)),
      progressBar(pct),
      h('p', { class: 'muted' }, 'Cada bloque terminado queda guardado. Si algo falla, continuamos desde ahí.'),
      stop));
  }

  function summarizeUsage(job) {
    const blocks = job?.blocks || [];
    let input = 0, output = 0, total = 0, cached = 0, reasoning = 0;
    let model = '';
    for (const b of blocks) {
      const u = b.usage || {};
      input += Number(u.input_tokens ?? u.prompt_tokens ?? 0);
      output += Number(u.output_tokens ?? u.completion_tokens ?? 0);
      total += Number(u.total_tokens ?? 0);
      cached += Number(u.input_tokens_details?.cached_tokens ?? u.prompt_tokens_details?.cached_tokens ?? 0);
      reasoning += Number(u.output_tokens_details?.reasoning_tokens ?? u.completion_tokens_details?.reasoning_tokens ?? 0);
      if (!model && b.model) model = b.model;
    }
    if (!total) total = input + output;
    return { input, output, total, cached, reasoning, model };
  }

  function usageCard(job, { smokeTest = false } = {}) {
    if (!job) return null;
    const u = summarizeUsage(job);
    const stat = (value, label) => h('div', { class: 'mini-stat' },
      h('b', {}, Number(value || 0).toLocaleString('es-CL')),
      h('small', { class: 'muted' }, label));
    return h('div', { class: 'usage-card' },
      h('div', { class: 'row between wrap' },
        h('strong', {}, smokeTest ? '🧪 Uso de esta única llamada' : '📊 Uso de IA'),
        u.model ? h('span', { class: 'badge' }, u.model) : null),
      h('div', { class: 'mini-stats' },
        stat(u.input, 'tokens entrada'),
        stat(u.output, 'tokens salida'),
        stat(u.total, 'tokens totales'),
        u.cached ? stat(u.cached, 'entrada cacheada') : null,
        u.reasoning ? stat(u.reasoning, 'reasoning') : null),
      smokeTest
        ? h('p', { class: 'muted' }, '✅ Study Paws se detuvo aquí. No se enviaron las diapositivas 6–41.')
        : null);
  }

  async function runAi(existingJobId = '') {
    const subject = findSubject(form.sid);
    const unit = findUnit(form.sid, form.unitId);
    const lesson = findLesson(form.sid, form.unitId, form.lessonId);
    if (!lesson) throw new Error('Elige una clase para generar con IA.');

    currentController = new AbortController();
    let result;
    try {
      if (existingJobId) {
        result = await resumeGeneration(existingJobId, {
          signal: currentController.signal,
          onProgress: (p) => { lastJobId = p.jobId || existingJobId; renderAiProgress(p); }
        });
      } else {
        const blocks = await prepareAiBlocks(subject, unit, lesson);
        const meta = {
          title: `${modeInfo(form.mode).label} · ${lesson.name}`,
          mode: form.mode,
          preset: form.preset,
          depth: form.depth,
          focus: form.focus,
          options: { mnemonics: form.mnemonics, summary: form.summary },
          subject: { id: subject.id, name: subject.name },
          unit: unit ? { id: unit.id, name: unit.name } : null,
          lesson: { id: lesson.id, name: lesson.name },
          files: (lesson.files || []).map((f) => ({
            name: f.name,
            type: f.type,
            sourceUse: f.sourceUse || 'auto',
            sourceNote: f.sourceNote || ''
          }))
        };

        result = await runPreparedGeneration({
          meta,
          blocks,
          signal: currentController.signal,
          onProgress: (p) => { lastJobId = p.jobId || lastJobId; renderAiProgress(p); }
        });
      }
      showPreview(result);
    } catch (err) {
      if (err?.name === 'AbortError') {
        out.replaceChildren(h('div', { class: 'card form-grid' },
          h('h2', {}, '⏸️ Generación pausada'),
          h('p', { class: 'muted' }, 'Los bloques terminados quedaron guardados.'),
          h('button', { class: 'btn', onClick: () => runAi(lastJobId) }, '▶️ Continuar')));
        return;
      }
      console.error(err);
      out.replaceChildren(h('div', { class: 'card form-grid' },
        h('h2', {}, '⚠️ La generación se detuvo'),
        h('p', {}, err?.message || 'Ocurrió un error.'),
        h('p', { class: 'muted' }, 'No se perdieron los bloques que ya terminaron.'),
        lastJobId
          ? h('button', { class: 'btn', onClick: () => runAi(lastJobId) }, '🔁 Reintentar desde el bloque fallido')
          : null));
    } finally {
      currentController = null;
    }
  }

  smokeBtn.addEventListener('click', async () => {
    smokeBtn.disabled = true;
    smokeBtn.textContent = '🐾 Preparando prueba…';
    lastJobId = '';

    try {
      const subject = findSubject(form.sid);
      const unit = findUnit(form.sid, form.unitId);
      const lesson = findLesson(form.sid, form.unitId, form.lessonId);
      if (!lesson) throw new Error('Elige una clase para hacer la prueba.');
      if (form.mode !== 'slides') throw new Error('La prueba segura está disponible en modo Diapositiva por diapositiva.');

      const allBlocks = await prepareAiBlocks(subject, unit, lesson);
      const firstBlock = allBlocks[0];
      if (!firstBlock) throw new Error('No encontré las primeras diapositivas para probar.');

      const meta = {
        title: `Prueba IA · ${firstBlock.label} · ${lesson.name}`,
        mode: form.mode,
        preset: form.preset,
        depth: form.depth,
        focus: form.focus,
        options: { mnemonics: form.mnemonics, summary: form.summary },
        subject: { id: subject.id, name: subject.name },
        unit: unit ? { id: unit.id, name: unit.name } : null,
        lesson: { id: lesson.id, name: lesson.name },
        smokeTest: true,
        files: (lesson.files || []).map((f) => ({
          name: f.name, type: f.type,
          sourceUse: f.sourceUse || 'auto',
          sourceNote: f.sourceNote || ''
        }))
      };

      currentController = new AbortController();
      const result = await runPreparedGeneration({
        meta,
        blocks: [firstBlock],
        signal: currentController.signal,
        onProgress: (p) => {
          lastJobId = p.jobId || lastJobId;
          renderAiProgress({ ...p, total: 1 });
        }
      });

      const usage = summarizeUsage(result.job);
      updateSilent((s) => {
        s.settings.aiSmokeTestPassed = false;
        s.settings.aiSmokeTestMeta = {
          generatedAt: Date.now(),
          lessonId: lesson.id,
          block: firstBlock.label,
          model: usage.model || '',
          inputTokens: usage.input,
          outputTokens: usage.output,
          totalTokens: usage.total,
          jobId: result.jobId
        };
      });

      showPreview(result, { smokeTest: true });
    } catch (err) {
      console.error(err);
      out.replaceChildren(h('div', { class: 'card form-grid' },
        h('h2', {}, err?.name === 'AbortError' ? '⏸️ Prueba detenida' : '⚠️ La prueba no terminó'),
        h('p', {}, err?.message || 'Ocurrió un error.'),
        h('p', { class: 'muted' }, 'No se inició ningún bloque posterior.')));
    } finally {
      currentController = null;
      smokeBtn.disabled = false;
      refreshAiButtons();
    }
  });

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      if (isAiConfigured()) {
        if (form.mode === 'slides' && !smokePassed()) {
          toast('Primero aprueba la prueba segura de slides 1–5 🧪');
          return;
        }
        btn.textContent = 'Preparando contexto… 🐾';
        await runAi();
        return;
      }

      btn.textContent = 'Escribiendo… 🐾';
      const subject = findSubject(form.sid);
      const unit = findUnit(form.sid, form.unitId);
      const lesson = findLesson(form.sid, form.unitId, form.lessonId);
      const result = await generateGuide({
        mode: form.mode, preset: form.preset, depth: form.depth,
        options: { mnemonics: form.mnemonics, summary: form.summary },
        subject: { id: subject.id, name: subject.name },
        unit: unit ? { id: unit.id, name: unit.name } : null,
        lesson: lesson ? { id: lesson.id, name: lesson.name } : null,
        files: await buildSourcePayload(lesson?.files ?? [])
      });
      showPreview(result);
    } catch (err) {
      console.error(err);
      toast(err?.message || 'No se pudo generar la guía');
    } finally {
      btn.disabled = false;
      refreshAiButtons();
    }
  });

  function showPreview(result, { smokeTest = false } = {}) {
    const titleInput = h('input', { type: 'text', value: result.title, maxlength: 120, 'aria-label': 'Título de la guía' });
    const save = (status) => {
      const id = saveGuide({
        title: titleInput.value.trim() || result.title, content: result.content, mode: form.mode,
        subjectId: form.sid, unitId: form.unitId, lessonId: form.lessonId, status
      });
      toast(status === 'draft' ? 'Borrador guardado 💾' : 'Guía guardada ✅');
      go(`#/guide/${id}`);
    };
    const approve = smokeTest
      ? h('button', { class: 'btn safe-approve-btn', onClick: () => {
          const u = summarizeUsage(result.job);
          updateSilent((s) => {
            s.settings.aiSmokeTestPassed = true;
            s.settings.aiSmokeTestMeta = {
              ...(s.settings.aiSmokeTestMeta || {}),
              approvedAt: Date.now(),
              model: u.model || s.settings.aiSmokeTestMeta?.model || '',
              inputTokens: u.input,
              outputTokens: u.output,
              totalTokens: u.total
            };
          });
          refreshAiButtons();
          approve.disabled = true;
          approve.textContent = '✅ Prueba aprobada · clase completa desbloqueada';
          toast('Generación completa desbloqueada 😻');
        } }, '😻 Está bien — desbloquear clase completa')
      : null;

    out.replaceChildren(h('div', { class: 'card form-grid' },
      h('h2', {}, smokeTest ? '🧪 Resultado de la prueba segura' : 'Vista previa'),
      smokeTest
        ? h('div', { class: 'safe-test-banner' },
            h('strong', {}, 'Solo se generaron las diapositivas 1–5.'),
            h('span', {}, ' Revisa calidad, profundidad y formato antes de autorizar el resto.'))
        : null,
      usageCard(result.job, { smokeTest }),
      titleInput,
      h('article', { class: 'guide-paper', html: md(result.content) }),
      approve,
      h('div', { class: 'row gap wrap' },
        h('button', { class: 'btn ghost', onClick: () => save('draft') }, '💾 Guardar borrador'),
        h('button', { class: 'btn', onClick: () => save('saved') }, '✅ Guardar guía'))));
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  fill();
  return h('section', { class: 'view' },
    h('h1', {}, 'Crear guía'),
    h('div', { class: 'banner' }, isAiConfigured()
      ? '✨ IA configurada: Study Paws usará Brain + contexto seleccionado + generación reanudable por bloques.'
      : '🧪 Modo demo: la arquitectura de IA ya está lista. Configura el backend en Ajustes para generar contenido real.'),
    h('div', { class: 'card form-grid' },
      h('div', { class: 'form-grid three' },
        h('label', { class: 'field' }, 'Materia', subjectSel),
        h('label', { class: 'field' }, 'Unidad', unitSel),
        h('label', { class: 'field' }, 'Clase', lessonSel)),
      sourcesBox),
    h('div', { class: 'card form-grid preset-section' },
      h('div', {}, h('h2', {}, 'Cómo quieres estudiar'), h('p', { class: 'muted' }, 'El preset cambia la estructura de la guía según la asignatura.')),
      presetGrid),
    h('div', { class: 'card form-grid' }, h('h2', {}, 'Modo de guía'), modeGrid),
    h('div', { class: 'card form-grid brain-plan-card' },
      h('h2', {}, '🧠 Plan de contexto antes de gastar API'),
      h('p', { class: 'muted' }, 'Study Paws decide primero qué Brain usar, qué fuentes priorizar, cuánto contexto pesa y si conviene dividirlo.'),
      planBox),
    h('div', { class: 'card form-grid' },
      h('h2', {}, 'Opciones'),
      h('label', { class: 'field' }, 'Profundidad', depthSel),
      h('label', { class: 'field' }, 'Enfoque o pregunta (opcional)', focusInput),
      h('label', { class: 'check' }, mnem, 'Incluir mnemotecnias'),
      h('label', { class: 'check' }, summ, 'Incluir resumen final')),
    h('div', { class: 'row gap wrap ai-actions' }, inspectBtn, smokeBtn, btn), out);
}

/* ---------- Guías guardadas ---------- */
let guideFilter = 'all';
function guideItem(g) {
  const sub = findSubject(g.subjectId);
  const m = modeInfo(g.mode);
  return h('a', { class: 'card guide-item', href: `#/guide/${g.id}` },
    h('h3', {}, `${m.icon} ${g.title}`),
    h('div', { class: 'row wrap' },
      h('span', { class: 'badge' }, g.status === 'draft' ? '📝 Borrador' : '✅ Guardada'),
      sub ? h('span', { class: 'muted' }, `${sub.emoji} ${sub.name}`) : null,
      h('span', { class: 'muted' }, fmtDate(g.updatedAt))));
}

function guidesView() {
  const all = listGuides();
  const list = all.filter((g) => guideFilter === 'all' || g.status === guideFilter);
  const chip = (id, label) => h('button', { class: `chip${guideFilter === id ? ' on' : ''}`, onClick: () => { guideFilter = id; render(); } }, label);
  return h('section', { class: 'view' },
    h('div', { class: 'row between' }, h('h1', {}, 'Mis guías'), h('a', { class: 'btn small', href: '#/create' }, '+ Nueva')),
    h('div', { class: 'chips' }, chip('all', `Todas (${all.length})`), chip('draft', 'Borradores'), chip('saved', 'Guardadas')),
    list.length ? list.map(guideItem) : emptyState('Nada por aquí', 'Genera una guía y guárdala para verla aquí.', h('a', { class: 'btn', href: '#/create' }, '✨ Crear guía')));
}

function guideView(id) {
  const g = findGuide(id);
  if (!g) return notFound();
  const s = findSubject(g.subjectId);
  const u = g.unitId ? findUnit(g.subjectId, g.unitId) : null;
  const l = g.lessonId ? findLesson(g.subjectId, g.unitId, g.lessonId) : null;

  const paper = h('article', { class: 'guide-paper', html: md(g.content) });
  const editor = h('textarea', { class: 'editor', 'aria-label': 'Contenido de la guía' }, g.content);
  const body = h('div', {}, paper);
  const bar = h('div', { class: 'row gap no-print' });

  const readButtons = () => [
    h('button', { class: 'btn small', onClick: () => setEditing(true) }, '✏️ Editar'),
    h('button', { class: 'btn ghost small', onClick: () => updateGuide(id, { status: g.status === 'draft' ? 'saved' : 'draft' }) },
      g.status === 'draft' ? '✅ Marcar como guardada' : '📝 Volver a borrador'),
    h('button', { class: 'btn ghost small', onClick: async () => { await navigator.clipboard?.writeText(g.content); toast('Copiada al portapapeles'); } }, '📋 Copiar'),
    h('button', { class: 'btn ghost small', onClick: () => window.print() }, '🖨️ Imprimir'),
    h('button', { class: 'btn ghost small', onClick: async () => {
      if (await confirmDialog({ title: '¿Eliminar esta guía?', confirm: 'Eliminar', danger: true })) { go('#/guides'); deleteGuide(id); toast('Guía eliminada'); }
    } }, '🗑️ Eliminar')
  ];
  function setEditing(on) {
    body.replaceChildren(on ? editor : paper);
    bar.replaceChildren(...(on ? [
      h('button', { class: 'btn small', onClick: () => { updateGuide(id, { content: editor.value }); toast('Cambios guardados 💾'); } }, '💾 Guardar cambios'),
      h('button', { class: 'btn ghost small', onClick: () => { editor.value = g.content; setEditing(false); } }, 'Cancelar')
    ] : readButtons()));
  }
  setEditing(false);

  return h('section', { class: 'view' },
    crumbs({ label: 'Guías', href: '#/guides' }, { label: g.title }),
    h('div', { class: 'row wrap no-print' },
      h('span', { class: 'badge' }, g.status === 'draft' ? '📝 Borrador' : '✅ Guardada'),
      s ? h('span', { class: 'muted' }, [s.emoji, ' ', s.name, u ? ` › ${u.name}` : '', l ? ` › ${l.name}` : '']) : null,
      h('span', { class: 'muted' }, `Actualizada ${fmtDate(g.updatedAt)}`)),
    bar, body);
}

/* ---------- Progreso ---------- */
function streak(log) {
  let n = 0;
  const d = new Date();
  if (!log[dayKey(d)]) d.setDate(d.getDate() - 1);
  while (log[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function progressView() {
  const st = allStats();
  const subs = getSubjects();
  const guides = listGuides();
  const log = getState().progress.log;
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { n: log[dayKey(d)] || 0, label: d.toLocaleDateString('es', { weekday: 'narrow' }) };
  });
  const max = Math.max(1, ...days.map((d) => d.n));
  const stat = (n, label) => h('div', { class: 'card stat' }, h('b', {}, n), h('small', { class: 'muted' }, label));
  const msg = !st.total ? 'Añade clases para empezar a medir tu progreso.'
    : st.pct === 100 ? '¡Todo estudiado! El gatito está orgulloso 🐾'
    : st.pct >= 50 ? 'Más de la mitad. ¡Ya casi!'
    : 'Cada clase cuenta. ¡Vamos poco a poco!';

  return h('section', { class: 'view' },
    h('div', { class: 'card hero' }, h('div', { class: 'hero-cat', html: catSvg() }),
      h('div', {}, h('h1', {}, 'Tu progreso'), h('p', { class: 'muted' }, msg))),
    h('div', { class: 'stats' },
      stat(`${st.pct}%`, 'clases estudiadas'),
      stat(`${st.done}/${st.total}`, 'clases'),
      stat(guides.length, 'guías'),
      stat(`🔥 ${streak(log)}`, 'días seguidos')),
    h('div', { class: 'card' }, h('h2', {}, 'Últimos 7 días'),
      h('div', { class: 'week', role: 'img', 'aria-label': 'Actividad de los últimos 7 días' },
        days.map((d) => h('div', { class: 'week-col' },
          h('div', { class: 'week-bar' }, h('i', { style: `height:${(d.n / max) * 100}%` })),
          h('small', { class: 'muted' }, d.label))))),
    h('div', { class: 'card form-grid' }, h('h2', {}, '🧠 Dominio multidimensional'),
      (() => {
        const k = averageKnowledge();
        return h('div', { class: 'knowledge-summary' },
          KNOWLEDGE_DIMENSIONS.map((d) =>
            h('div', { class: 'mini-stat' },
              h('b', {}, `${d.icon} ${Number(k[d.id] || 0).toFixed(1)}/4`),
              h('small', { class: 'muted' }, d.label))));
      })()),
    h('div', { class: 'card form-grid' }, h('h2', {}, 'Por materia'),
      subs.length ? subs.map((s) => {
        const x = subjectStats(s);
        return h('div', {}, h('div', { class: 'row between' }, h('strong', {}, `${s.emoji} ${s.name}`), h('span', { class: 'muted' }, `${x.done}/${x.total}`)), progressBar(x.pct));
      }) : h('p', { class: 'muted' }, 'Todavía no hay materias.')));
}

/* ---------- Ajustes ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; if (location.hash === '#/settings') render(); });

function settingsView() {
  const theme = getState().settings.theme;
  const usage = h('p', { class: 'muted' }, 'Calculando espacio…');
  navigator.storage?.estimate?.().then((e) => { usage.textContent = `Espacio usado: ${formatSize(e.usage || 0)} de ${formatSize(e.quota || 0)} disponibles.`; }).catch(() => { usage.textContent = ''; });

  const importInput = h('input', { type: 'file', accept: 'application/json', class: 'sr-only', id: 'import-input', onChange: async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { importData(await file.text()); toast('Copia importada ✅'); } catch { toast('Archivo no válido'); }
    e.target.value = '';
  } });

  return h('section', { class: 'view' },
    h('h1', {}, 'Ajustes'),
    h('div', { class: 'card form-grid' }, h('h2', {}, 'Apariencia'),
      h('div', { class: 'chips' }, [['auto', '🌗 Automático'], ['light', '☀️ Claro'], ['dark', '🌙 Oscuro']].map(([id, label]) =>
        h('button', { class: `chip${theme === id ? ' on' : ''}`, onClick: () => setTheme(id) }, label)))),
    deferredInstall ? h('div', { class: 'card form-grid' }, h('h2', {}, 'Instalar'),
      h('p', { class: 'muted' }, 'Instala Study Paws para abrirla como una app y usarla sin conexión.'),
      h('button', { class: 'btn', onClick: async () => { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; render(); } }, '📲 Instalar app')) : null,
    h('div', { class: 'card form-grid' }, h('h2', {}, '🐾 Study Paws Brain'),
      h('p', {}, `Brain V${BRAIN_VERSION}: reglas globales + Interna materia + Interna práctica + Farmacología.`),
      h('p', { class: 'muted' }, 'La futura IA recibirá solo el perfil y las fuentes necesarias para la tarea activa, no todo tu historial.')),
    (() => {
      const endpointInput = h('input', {
        type: 'url',
        value: getState().settings.aiEndpoint || '',
        placeholder: 'https://study-paws-ai.tu-cuenta.workers.dev',
        'aria-label': 'URL del backend de Study Paws'
      });
      const tokenInput = h('input', {
        type: 'password',
        value: getBackendAccessToken(),
        placeholder: 'Token de acceso personal',
        autocomplete: 'off',
        'aria-label': 'Token de acceso personal del backend'
      });
      const status = h('p', { class: 'muted' },
        isAiConfigured() ? '🟢 Backend configurado localmente.' : '⚪ Todavía en modo demo.');

      const save = h('button', { class: 'btn ghost', type: 'button', onClick: () => {
        const endpoint = endpointInput.value.trim().replace(/\/$/, '');
        updateSilent((s) => { s.settings.aiEndpoint = endpoint; });
        setBackendAccessToken(tokenInput.value);
        status.textContent = endpoint && tokenInput.value.trim()
          ? '🟢 Configuración guardada. Puedes probar la conexión.'
          : '⚪ Configuración incompleta.';
        toast('Configuración de IA guardada 🔐');
      } }, '💾 Guardar configuración');

      const test = h('button', { class: 'btn', type: 'button', onClick: async () => {
        try {
          test.disabled = true;
          test.textContent = 'Probando…';
          const endpoint = endpointInput.value.trim().replace(/\/$/, '');
          updateSilent((s) => { s.settings.aiEndpoint = endpoint; });
          setBackendAccessToken(tokenInput.value);
          const r = await testAiBackend();
          status.textContent = `🟢 Conectado · ${r.model || 'modelo configurado'}`;
          toast('Backend conectado ✅');
        } catch (e) {
          status.textContent = `🔴 ${e.message}`;
          toast(e.message || 'No se pudo conectar');
        } finally {
          test.disabled = false;
          test.textContent = '🔌 Probar conexión';
        }
      } }, '🔌 Probar conexión');

      return h('div', { class: 'card form-grid ai-settings-card' },
        h('h2', {}, '✨ IA segura'),
        h('p', { class: 'muted' }, 'La API key de OpenAI vive solo en el backend. Aquí guardas únicamente la URL del Worker y un token personal revocable. El token NO se incluye en tus backups.'),
        h('label', { class: 'field' }, 'URL del backend', endpointInput),
        h('label', { class: 'field' }, 'Token de acceso de Study Paws', tokenInput),
        status,
        h('div', { class: 'row gap wrap' }, save, test));
    })(),
    h('div', { class: 'card form-grid' }, h('h2', {}, 'Tus datos'),
      h('p', { class: 'muted' }, 'Todo se guarda solo en este dispositivo. La copia de seguridad incluye materias, clases, guías y progreso, pero no los archivos adjuntos.'),
      usage,
      h('div', { class: 'row gap' },
        h('button', { class: 'btn ghost', onClick: () => {
          const a = h('a', { href: URL.createObjectURL(new Blob([exportData()], { type: 'application/json' })), download: `study-paws-${dayKey()}.json` });
          document.body.append(a); a.click(); a.remove();
        } }, '⬇️ Exportar copia'),
        h('label', { class: 'btn ghost', for: 'import-input' }, '⬆️ Importar copia'), importInput),
      h('button', { class: 'btn danger', onClick: async () => {
        if (await confirmDialog({ title: '¿Borrar todos los datos?', text: 'Se eliminarán materias, archivos y guías de este dispositivo.', confirm: 'Borrar todo', danger: true })) {
          await resetAll(); go('#/'); toast('Datos borrados');
        }
      } }, '🗑️ Borrar todos los datos')),
    h('p', { class: 'muted' }, 'Study Paws V0.6.1 · Safe First Test + AI Pipeline seguro.'));
}

/* ================= Router ================= */
const routes = [
  [/^#\/?$/, homeView],
  [/^#\/subject\/([^/]+)$/, subjectView],
  [/^#\/lesson\/([^/]+)\/([^/]+)\/([^/]+)$/, lessonView],
  [/^#\/create$/, createView],
  [/^#\/guides$/, guidesView],
  [/^#\/guide\/([^/]+)$/, guideView],
  [/^#\/progress$/, progressView],
  [/^#\/settings$/, settingsView]
];

let lastPath = null;
function render() {
  const [path, query = ''] = (location.hash || '#/').split('?');
  let node = notFound();
  try {
    for (const [re, view] of routes) {
      const m = path.match(re);
      if (m) { node = view(...m.slice(1), query); break; }
    }
  } catch (err) {
    console.error(err);
    node = emptyState('Algo salió mal', 'Recarga la página. Tus datos siguen guardados.');
  }
  app.replaceChildren(node);

  const section = path.startsWith('#/create') ? 'create' : path.startsWith('#/guide') ? 'guides'
    : path.startsWith('#/progress') ? 'progress' : path.startsWith('#/settings') ? 'settings' : 'home';
  document.querySelectorAll('.nav a').forEach((a) => {
    const on = a.dataset.nav === section;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (path !== lastPath) { window.scrollTo(0, 0); lastPath = path; }
}

/* ================= Arranque ================= */
subscribe(() => { applyTheme(); render(); });
window.addEventListener('hashchange', render);
window.addEventListener('studypaws:storage-error', () => toast('⚠️ Almacenamiento lleno: libera espacio o exporta una copia'));
document.getElementById('dlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

applyTheme();
render();
navigator.storage?.persist?.();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW no registrado', err)));
}
