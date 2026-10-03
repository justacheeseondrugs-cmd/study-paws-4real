// Punto de entrada: tema, router y vistas.
import { getState, subscribe, update, exportData, importData, resetAll, dayKey } from './storage.js';
import {
  getSubjects, findSubject, findUnit, findLesson, lessonsOf, subjectStats, allStats,
  addSubject, renameSubject, deleteSubject, addUnit, renameUnit, deleteUnit,
  addLesson, renameLesson, deleteLesson, toggleLessonDone
} from './subjects.js';
import { FILE_TYPES, typeInfo, attachFiles, setFileType, setSourceUse, removeFile, openFile, formatSize, extractAndStoreText, openExtractedText, buildSourcePayload } from './files.js';
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
            }, n === 0 ? '·' : String(n))))));
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
    h('div', { class: 'fname' }, f.name, h('div', { class: 'muted', style: 'font-weight:400;font-size:.8rem' }, formatSize(f.size))),
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
    depth: 'intermediate', mnemonics: true, summary: true
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
      h('input', { type: 'radio', name: 'mode', value: m.id, checked: m.id === form.mode, onChange: () => { form.mode = m.id; renderPlan(); } }),
      h('span', { class: 'mode-body' }, h('span', { class: 'mode-icon' }, m.icon), h('strong', {}, m.label), h('small', {}, m.desc)))));

  const depthSel = h('select', { 'aria-label': 'Profundidad', onChange: (e) => { form.depth = e.target.value; renderPlan(); } },
    DEPTHS.map((d) => h('option', { value: d.id, selected: d.id === form.depth }, d.label)));
  const mnem = h('input', { type: 'checkbox', checked: true, onChange: (e) => { form.mnemonics = e.target.checked; } });
  const summ = h('input', { type: 'checkbox', checked: true, onChange: (e) => { form.summary = e.target.checked; } });

  const out = h('div', { class: 'view' });
  const btn = h('button', { class: 'btn', type: 'button' }, '✨ Generar guía (demo)');

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Escribiendo… 🐾';
    try {
      const subject = findSubject(form.sid);
      const unit = findUnit(form.sid, form.unitId);
      const lesson = findLesson(form.sid, form.unitId, form.lessonId);
      const result = await generateGuide({
        mode: form.mode, preset: form.preset, depth: form.depth, options: { mnemonics: form.mnemonics, summary: form.summary },
        subject: { id: subject.id, name: subject.name },
        unit: unit ? { id: unit.id, name: unit.name } : null,
        lesson: lesson ? { id: lesson.id, name: lesson.name } : null,
        files: await buildSourcePayload(lesson?.files ?? [])
      });
      showPreview(result);
    } catch (err) {
      console.error(err);
      toast('No se pudo generar la guía');
    } finally {
      btn.disabled = false;
      btn.textContent = '✨ Generar guía (demo)';
    }
  });

  function showPreview(result) {
    const titleInput = h('input', { type: 'text', value: result.title, maxlength: 120, 'aria-label': 'Título de la guía' });
    const save = (status) => {
      const id = saveGuide({
        title: titleInput.value.trim() || result.title, content: result.content, mode: form.mode,
        subjectId: form.sid, unitId: form.unitId, lessonId: form.lessonId, status
      });
      toast(status === 'draft' ? 'Borrador guardado 💾' : 'Guía guardada ✅');
      go(`#/guide/${id}`);
    };
    out.replaceChildren(h('div', { class: 'card form-grid' },
      h('h2', {}, 'Vista previa'),
      titleInput,
      h('article', { class: 'guide-paper', html: md(result.content) }),
      h('div', { class: 'row gap' },
        h('button', { class: 'btn ghost', onClick: () => save('draft') }, '💾 Guardar borrador'),
        h('button', { class: 'btn', onClick: () => save('saved') }, '✅ Guardar guía'))));
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  fill();
  return h('section', { class: 'view' },
    h('h1', {}, 'Crear guía'),
    h('div', { class: 'banner' }, '🧪 Modo demo: todavía no hay IA conectada, así que el contenido es de ejemplo. Lo que ves aquí ya es el flujo final.'),
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
      h('label', { class: 'check' }, mnem, 'Incluir mnemotecnias'),
      h('label', { class: 'check' }, summ, 'Incluir resumen final')),
    btn, out);
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
    h('p', { class: 'muted' }, 'Study Paws V0.4.0 · Brain + planificación de contexto · sin IA todavía.'));
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
