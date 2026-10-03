// Archivos adjuntos por clase. Metadatos en el estado, contenido en IndexedDB.
import { update, newId, putBlob, getBlob, deleteBlob } from './storage.js';
import { findLesson } from './subjects.js';
import { extractTextFromFile, canExtractText } from './extract.js';

export const FILE_TYPES = [
  { id: 'ppt', label: 'PPT', icon: '📊' },
  { id: 'pdf', label: 'PDF / diapositivas', icon: '📄' },
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
  if (/\.pdf$/.test(n)) return 'pdf';
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
        sourceUse: 'auto',
        sourceNote: '',
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

export function setSourceUse(sid, unitId, lessonId, fileId, sourceUse, sourceNote = '') {
  update(() => {
    const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
    if (!f) return;
    f.sourceUse = sourceUse;
    f.sourceNote = sourceNote;
  });
}

const textKey = (id) => `text:${id}`;

export async function extractAndStoreText(sid, unitId, lessonId, fileId) {
  const meta = findLesson(sid, unitId, lessonId)?.files.find((f) => f.id === fileId);
  if (!meta) throw new Error('Archivo no encontrado');
  const blob = await getBlob(fileId);
  if (!blob) throw new Error('Archivo no encontrado');

  update(() => {
    const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
    if (f) { f.textStatus = 'reading'; f.textError = ''; }
  });

  try {
    const result = await extractTextFromFile(blob, meta.name);
    await putBlob(textKey(fileId), new Blob([result.text], { type: 'text/plain;charset=utf-8' }));
    update(() => {
      const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
      if (f) {
        f.textStatus = 'ready';
        f.textChars = result.text.length;
        f.textEngine = result.engine;
        f.textPages = result.pages || 0;
        if (f.type === 'other' && /\.pdf$/i.test(f.name)) f.type = 'pdf';
        f.textError = '';
      }
    });
    return { chars: result.text.length, engine: result.engine };
  } catch (err) {
    update(() => {
      const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
      if (f) {
        f.textStatus = 'error';
        f.textError = err?.message || 'No se pudo leer el archivo';
      }
    });
    throw err;
  }
}

export async function getExtractedText(fileId) {
  const blob = await getBlob(textKey(fileId));
  if (!blob) return '';
  if (typeof blob === 'string') return blob;
  return typeof blob.text === 'function' ? blob.text() : String(blob);
}

export async function openExtractedText(meta) {
  const text = await getExtractedText(meta.id);
  if (!text) throw new Error('Primero lee el documento');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const w = window.open(url, '_blank', 'noopener');
  if (!w) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.name.replace(/\.[^.]+$/, '')}-texto.txt`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function buildSourcePayload(metas = []) {
  return Promise.all(metas.map(async (f) => ({
    name: f.name,
    type: f.type,
    textStatus: f.textStatus || '',
    textChars: f.textChars || 0,
    textPages: f.textPages || 0,
    sourceUse: f.sourceUse || 'auto',
    sourceNote: f.sourceNote || '',
    canExtract: canExtractText({ type: f.mime }, f.name),
    text: f.textStatus === 'ready' ? await getExtractedText(f.id) : ''
  })));
}

export async function removeFile(sid, unitId, lessonId, fileId) {
  update(() => {
    const l = findLesson(sid, unitId, lessonId);
    if (l) l.files = l.files.filter((f) => f.id !== fileId);
  });
  await Promise.allSettled([deleteBlob(fileId), deleteBlob(textKey(fileId))]);
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
