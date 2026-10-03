// Archivos adjuntos por clase. Metadatos en el estado, contenido en IndexedDB.
import { update, newId, putBlob, getBlob, deleteBlob } from './storage.js';
import { findLesson } from './subjects.js';

export const FILE_TYPES = [
  { id: 'ppt', label: 'PPT', icon: '📊' },
  { id: 'transcript', label: 'Transcripción', icon: '🎙️' },
  { id: 'guide', label: 'Guía', icon: '📝' },
  { id: 'book', label: 'Libro', icon: '📚' },
  { id: 'other', label: 'Otro', icon: '📎' }
];
export const typeInfo = (id) => FILE_TYPES.find((t) => t.id === id) ?? FILE_TYPES[FILE_TYPES.length - 1];

/** Intenta adivinar el tipo por el nombre; el usuario puede cambiarlo. */
export function guessType(name = '') {
  const n = name.toLowerCase();
  if (/\.(pptx?|key|odp)$/.test(n)) return 'ppt';
  if (/transcrip|\.(vtt|srt)$/.test(n)) return 'transcript';
  if (/gu[ií]a|guide/.test(n)) return 'guide';
  if (/libro|book|cap[ií]tulo|\.epub$/.test(n)) return 'book';
  return 'other';
}

export function formatSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export async function attachFiles(sid, unitId, lessonId, fileList, forcedType = 'auto') {
  const metas = [];
  const failed = [];
  for (const f of fileList) {
    const id = newId();
    try {
      await putBlob(id, f);
      metas.push({
        id, name: f.name, size: f.size, mime: f.type,
        type: forcedType !== 'auto' ? forcedType : guessType(f.name),
        addedAt: Date.now()
      });
    } catch (err) {
      console.warn('No se pudo guardar', f.name, err);
      failed.push(f.name);
    }
  }
  if (metas.length) update(() => { findLesson(sid, unitId, lessonId)?.files.push(...metas); });
  return { added: metas.length, failed };
}

export function setFileType(sid, unitId, lessonId, fileId, type) {
  update(() => {
    const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
    if (f) f.type = type;
  });
}

export async function removeFile(sid, unitId, lessonId, fileId) {
  update(() => {
    const l = findLesson(sid, unitId, lessonId);
    if (l) l.files = l.files.filter((f) => f.id !== fileId);
  });
  await deleteBlob(fileId).catch(() => {});
}

export async function openFile(meta) {
  const blob = await getBlob(meta.id);
  if (!blob) throw new Error('Archivo no encontrado');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  if (!/^(application\/pdf|image\/|text\/)/.test(blob.type)) a.download = meta.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
