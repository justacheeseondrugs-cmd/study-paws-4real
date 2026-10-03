// Extracción local de texto para Study Paws.
// Los archivos nunca se envían fuera del dispositivo en esta etapa.
const MAMMOTH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.10.0/mammoth.browser.min.js';
let mammothPromise = null;

function extension(name = '') {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function cleanText(text = '') {
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function loadMammoth() {
  if (globalThis.mammoth) return Promise.resolve(globalThis.mammoth);
  if (mammothPromise) return mammothPromise;
  mammothPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = MAMMOTH_URL;
    script.async = true;
    script.onload = () => globalThis.mammoth ? resolve(globalThis.mammoth) : reject(new Error('Mammoth no se cargó'));
    script.onerror = () => reject(new Error('No se pudo cargar el lector DOCX. Revisa tu conexión.'));
    document.head.append(script);
  });
  return mammothPromise;
}

export function canExtractText(file, name = file?.name || '') {
  const ext = extension(name);
  return ['.docx', '.txt', '.md', '.csv', '.json', '.html', '.htm', '.vtt', '.srt'].includes(ext)
    || /^text\//.test(file?.type || '');
}

export async function extractTextFromFile(file, name = file?.name || '') {
  if (!file) throw new Error('Archivo no encontrado');
  const ext = extension(name);

  if (ext === '.doc') {
    throw new Error('El formato .doc antiguo todavía no se puede leer. Guárdalo como .docx.');
  }
  if (ext === '.pdf') {
    throw new Error('El lector PDF viene en la siguiente etapa. Por ahora usa DOCX o texto.');
  }
  if (ext === '.ppt' || ext === '.pptx') {
    throw new Error('El lector de PowerPoint viene después. Por ahora usa el DOC/tipeo de la clase.');
  }

  if (ext === '.docx') {
    const mammoth = await loadMammoth();
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = cleanText(result.value);
    if (!text) throw new Error('No se encontró texto legible en el DOCX.');
    return { text, engine: 'mammoth-docx', warnings: result.messages || [] };
  }

  if (canExtractText(file, name)) {
    const text = cleanText(await file.text());
    if (!text) throw new Error('El archivo está vacío o no contiene texto legible.');
    return { text, engine: 'browser-text', warnings: [] };
  }

  throw new Error('Todavía no sé leer este formato. Prueba con .docx, .txt o .md.');
}
