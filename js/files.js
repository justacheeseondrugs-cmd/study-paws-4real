// Archivos adjuntos por clase. Metadatos en el estado, contenido en IndexedDB.
import { update, newId, putBlob, getBlob, deleteBlob } from './storage.js';
import { findLesson } from './subjects.js';
import { extractTextFromFile, canExtractText } from './extract.js';
import { buildDocumentIndex, INDEX_VERSION } from './study-retrieval.js';
import { alignSlidesWithTranscript } from './smart-class.js';

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
const indexKey = (id) => `index:${id}`;
const alignmentKey = (slideId, transcriptId) => `align:${slideId}:${transcriptId}`;

async function storeDocumentIndex(fileId, meta, text) {
  const index = buildDocumentIndex({
    fileId,
    name: meta.name,
    type: meta.type,
    text,
    textPages: meta.textPages || 0
  });
  await putBlob(indexKey(fileId), new Blob([JSON.stringify(index)], { type: 'application/json' }));
  return index;
}

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
        f.indexStatus = 'building';
      }
    });

    const freshMeta = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId) || meta;
    let index = null;
    try {
      index = await storeDocumentIndex(fileId, freshMeta, result.text);
      update(() => {
        const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
        if (f) {
          f.indexStatus = 'ready';
          f.indexVersion = index.version;
          f.chunkCount = index.chunkCount;
          f.indexError = '';
        }
      });
    } catch (indexErr) {
      console.warn('Texto leído, pero no se pudo indexar', meta.name, indexErr);
      update(() => {
        const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
        if (f) {
          f.indexStatus = 'error';
          f.indexError = indexErr?.message || 'No se pudo indexar';
        }
      });
    }
    return { chars: result.text.length, engine: result.engine, chunks: index?.chunkCount || 0 };
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

export async function getDocumentIndex(fileId) {
  const blob = await getBlob(indexKey(fileId));
  if (!blob) return null;
  try {
    const text = typeof blob === 'string' ? blob : await blob.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function ensureDocumentIndex(sid, unitId, lessonId, fileId) {
  const meta = findLesson(sid, unitId, lessonId)?.files.find((f) => f.id === fileId);
  if (!meta) throw new Error('Archivo no encontrado');
  if (meta.textStatus !== 'ready') throw new Error('Primero lee el documento');

  const existing = await getDocumentIndex(fileId);
  if (existing?.version === INDEX_VERSION && existing?.chunkCount >= 0) {
    if (meta.indexStatus !== 'ready' || meta.chunkCount !== existing.chunkCount) {
      update(() => {
        const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
        if (f) {
          f.indexStatus = 'ready';
          f.indexVersion = existing.version;
          f.chunkCount = existing.chunkCount;
        }
      });
    }
    return existing;
  }

  const text = await getExtractedText(fileId);
  if (!text) throw new Error('No hay texto extraído para indexar');
  update(() => {
    const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
    if (f) f.indexStatus = 'building';
  });
  const index = await storeDocumentIndex(fileId, meta, text);
  update(() => {
    const f = findLesson(sid, unitId, lessonId)?.files.find((x) => x.id === fileId);
    if (f) {
      f.indexStatus = 'ready';
      f.indexVersion = index.version;
      f.chunkCount = index.chunkCount;
    }
  });
  return index;
}

export async function ensureLessonIndexes(sid, unitId, lessonId, metas = []) {
  const ready = metas.filter((f) => f.textStatus === 'ready' && f.sourceUse !== 'exclude');
  const results = [];
  for (const f of ready) {
    try {
      results.push(await ensureDocumentIndex(sid, unitId, lessonId, f.id));
    } catch (error) {
      results.push(null);
    }
  }
  return results.filter(Boolean);
}

export async function getPairAlignment(slideId, transcriptId) {
  const blob = await getBlob(alignmentKey(slideId, transcriptId));
  if (!blob) return null;
  try {
    const text = typeof blob === 'string' ? blob : await blob.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function buildPairAlignment(sid, unitId, lessonId, pair) {
  const slideIndex = await ensureDocumentIndex(sid, unitId, lessonId, pair.slideId);
  const transcriptIndex = await ensureDocumentIndex(sid, unitId, lessonId, pair.transcriptId);
  const items = alignSlidesWithTranscript(slideIndex, transcriptIndex, { maxTranscriptChunks: 2 });
  const alignment = {
    version: 2,
    slideId: pair.slideId,
    transcriptId: pair.transcriptId,
    slideName: pair.slideName,
    transcriptName: pair.transcriptName,
    pairConfidence: pair.confidence || '',
    createdAt: Date.now(),
    items
  };
  await putBlob(
    alignmentKey(pair.slideId, pair.transcriptId),
    new Blob([JSON.stringify(alignment)], { type: 'application/json' })
  );
  return alignment;
}

export async function buildLessonAlignments(sid, unitId, lessonId, pairs = []) {
  const out = [];
  for (const pair of pairs) {
    try {
      out.push(await buildPairAlignment(sid, unitId, lessonId, pair));
    } catch (error) {
      console.warn('No se pudo alinear la pareja', pair, error);
    }
  }
  return out;
}

export async function getLessonAlignments(pairs = []) {
  const out = [];
  for (const pair of pairs) {
    const saved = await getPairAlignment(pair.slideId, pair.transcriptId);
    if (saved?.version === 2) out.push(saved);
  }
  return out;
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
    id: f.id,
    name: f.name,
    type: f.type,
    textStatus: f.textStatus || '',
    textChars: f.textChars || 0,
    textPages: f.textPages || 0,
    indexStatus: f.indexStatus || '',
    chunkCount: f.chunkCount || 0,
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
  await Promise.allSettled([deleteBlob(fileId), deleteBlob(textKey(fileId)), deleteBlob(indexKey(fileId))]);
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
