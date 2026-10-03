// Materias → Unidades → Clases.
import { getState, update, newId, bumpLog, deleteBlob } from './storage.js';

const EMOJIS = ['🫀', '🧠', '🫁', '🦴', '🧬', '💊', '🔬', '🩺'];

export const getSubjects = () => getState().subjects;
export const findSubject = (id) => getSubjects().find((s) => s.id === id);
export const findUnit = (sid, unitId) => findSubject(sid)?.units.find((u) => u.id === unitId);
export const findLesson = (sid, unitId, lessonId) =>
  findUnit(sid, unitId)?.lessons.find((l) => l.id === lessonId);
export const lessonsOf = (s) => s.units.flatMap((u) => u.lessons);
const fileIdsOf = (lessons) => lessons.flatMap((l) => l.files.map((f) => f.id));

export function subjectStats(s) {
  const ls = lessonsOf(s);
  const done = ls.filter((l) => l.done).length;
  return { total: ls.length, done, pct: ls.length ? Math.round((done / ls.length) * 100) : 0 };
}

export function allStats() {
  const subs = getSubjects();
  const total = subs.reduce((n, s) => n + lessonsOf(s).length, 0);
  const done = subs.reduce((n, s) => n + subjectStats(s).done, 0);
  return { subjects: subs.length, total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

/* ----- Materias ----- */
export function addSubject(name) {
  const id = newId();
  update((s) => {
    const i = s.subjects.length;
    s.subjects.push({ id, name, emoji: EMOJIS[i % EMOJIS.length], color: i % 6, units: [], createdAt: Date.now() });
  });
  return id;
}
export function renameSubject(id, name) {
  update(() => { const s = findSubject(id); if (s) s.name = name; });
}
export async function deleteSubject(id) {
  const s = findSubject(id);
  if (!s) return;
  const ids = fileIdsOf(lessonsOf(s));
  update((st) => {
    st.subjects = st.subjects.filter((x) => x.id !== id);
    st.guides = st.guides.filter((g) => g.subjectId !== id);
  });
  await Promise.allSettled(ids.map(deleteBlob));
}

/* ----- Unidades ----- */
export function addUnit(sid, name) {
  update(() => { findSubject(sid)?.units.push({ id: newId(), name, lessons: [] }); });
}
export function renameUnit(sid, unitId, name) {
  update(() => { const u = findUnit(sid, unitId); if (u) u.name = name; });
}
export async function deleteUnit(sid, unitId) {
  const u = findUnit(sid, unitId);
  if (!u) return;
  const ids = fileIdsOf(u.lessons);
  update((st) => {
    const s = findSubject(sid);
    s.units = s.units.filter((x) => x.id !== unitId);
    // Las guías se conservan, solo se desvinculan de la unidad/clases.
    st.guides.forEach((g) => { if (g.unitId === unitId) { g.unitId = ''; g.lessonId = ''; } });
  });
  await Promise.allSettled(ids.map(deleteBlob));
}

/* ----- Clases ----- */
export function addLesson(sid, unitId, name) {
  update(() => {
    findUnit(sid, unitId)?.lessons.push({ id: newId(), name, done: false, files: [], createdAt: Date.now() });
  });
}
export function renameLesson(sid, unitId, lessonId, name) {
  update(() => { const l = findLesson(sid, unitId, lessonId); if (l) l.name = name; });
}
export async function deleteLesson(sid, unitId, lessonId) {
  const l = findLesson(sid, unitId, lessonId);
  if (!l) return;
  const ids = fileIdsOf([l]);
  update((st) => {
    const u = findUnit(sid, unitId);
    u.lessons = u.lessons.filter((x) => x.id !== lessonId);
    st.guides.forEach((g) => { if (g.lessonId === lessonId) g.lessonId = ''; });
  });
  await Promise.allSettled(ids.map(deleteBlob));
}
export function toggleLessonDone(sid, unitId, lessonId) {
  update((st) => {
    const l = findLesson(sid, unitId, lessonId);
    if (!l) return;
    l.done = !l.done;
    if (l.done) bumpLog(st);
  });
}
