// Capa de almacenamiento.
// - Estado (materias, guías, ajustes): localStorage, JSON.
// - Archivos adjuntos (blobs): IndexedDB, porque localStorage no soporta archivos.
// Para migrar a un backend más adelante, basta con reimplementar estas funciones.

const KEY = 'studypaws:v1';
const DB_NAME = 'studypaws-files';
const STORE = 'blobs';
const subs = new Set();

const defaults = () => ({
  version: 1,
  settings: { theme: 'auto', brainVersion: '1.0', aiEndpoint: '', aiSmokeTestPassed: false, aiSmokeTestMeta: null },
  subjects: [],
  guides: [],
  generationJobs: [],
  knowledge: {},
  progress: { log: {} }
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const data = JSON.parse(raw);
    const d = defaults();
    return {
      ...d, ...data,
      settings: { ...d.settings, ...data.settings },
      generationJobs: Array.isArray(data.generationJobs) ? data.generationJobs : [],
      knowledge: { ...d.knowledge, ...(data.knowledge || {}) },
      progress: { ...d.progress, ...data.progress }
    };
  } catch (err) {
    console.warn('No se pudo leer el almacenamiento', err);
    return defaults();
  }
}

let state = load();

export const getState = () => state;
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Registra actividad del día (para racha y gráfico semanal). Úsalo dentro de update(). */
export function bumpLog(s) {
  const k = dayKey();
  s.progress.log[k] = (s.progress.log[k] || 0) + 1;
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    window.dispatchEvent(new CustomEvent('studypaws:storage-error', { detail: err }));
  }
}
const notify = () => subs.forEach((cb) => cb(state));

/** Modifica el estado, lo guarda y avisa a los suscriptores (re-render). */
export function update(mutator) {
  mutator(state);
  persist();
  notify();
}
/** Guarda cambios internos sin forzar un re-render global (ej. progreso de generación por bloques). */
export function updateSilent(mutator) {
  mutator(state);
  persist();
}
export function subscribe(cb) { subs.add(cb); return () => subs.delete(cb); }

/* ---------- Copias de seguridad (solo datos, sin archivos adjuntos) ---------- */
export const exportData = () => JSON.stringify(state, null, 2);

export function importData(json) {
  const data = JSON.parse(json);
  if (!data || !Array.isArray(data.subjects) || !Array.isArray(data.guides)) {
    throw new Error('Archivo no válido');
  }
  const d = defaults();
  state = { ...d, ...data, settings: { ...d.settings, ...data.settings }, generationJobs: Array.isArray(data.generationJobs) ? data.generationJobs : [], knowledge: { ...d.knowledge, ...(data.knowledge || {}) }, progress: { ...d.progress, ...data.progress } };
  persist();
  notify();
}

export async function resetAll() {
  state = defaults();
  localStorage.removeItem(KEY);
  localStorage.removeItem('studypaws:backend-access-token');
  try { await clearBlobs(); } catch { /* ignorar */ }
  notify();
}

/* ---------- IndexedDB para archivos ---------- */
let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const putBlob = (id, blob) => tx('readwrite', (s) => s.put(blob, id));
export const getBlob = (id) => tx('readonly', (s) => s.get(id));
export const deleteBlob = (id) => tx('readwrite', (s) => s.delete(id));
export const clearBlobs = () => tx('readwrite', (s) => s.clear());
