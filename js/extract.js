// Extracción local de texto para Study Paws.
// DOCX y PDF se procesan en el navegador; no se envían fuera del dispositivo.
const MAMMOTH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.10.0/mammoth.browser.min.js';
const PDFJS_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
const PDFJS_WORKER_URL = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

let mammothPromise = null;
let pdfjsPromise = null;

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

async function loadPdfJs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = import(PDFJS_URL).then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return pdfjs;
  }).catch((err) => {
    pdfjsPromise = null;
    console.error(err);
    throw new Error('No se pudo cargar el lector PDF. Revisa tu conexión y vuelve a intentar.');
  });
  return pdfjsPromise;
}

async function extractPdf(file) {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items || [];
    let text = '';
    let lastY = null;

    for (const item of items) {
      const str = item.str || '';
      const y = item.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) text += '\n';
      else if (text && !text.endsWith('\n')) text += ' ';
      text += str;
      lastY = y;
    }

    text = cleanText(text);
    totalChars += text.length;
    pages.push(`[[STUDY_PAWS_PAGE:${pageNumber}]]\n${text || '[Sin texto extraíble en esta página]'}`);
  }

  const joined = pages.join('\n\n');
  if (totalChars < 20) {
    throw new Error('Este PDF parece ser escaneado o compuesto por imágenes. Necesitará OCR/visión en una etapa posterior.');
  }

  return { text: joined, engine: 'pdfjs', pages: pdf.numPages, warnings: [] };
}

export function canExtractText(file, name = file?.name || '') {
  const ext = extension(name);
  return ['.pdf', '.docx', '.txt', '.md', '.csv', '.json', '.html', '.htm', '.vtt', '.srt'].includes(ext)
    || /^text\//.test(file?.type || '');
}

export async function extractTextFromFile(file, name = file?.name || '') {
  if (!file) throw new Error('Archivo no encontrado');
  const ext = extension(name);

  if (ext === '.doc') {
    throw new Error('El formato .doc antiguo todavía no se puede leer. Guárdalo como .docx.');
  }
  if (ext === '.ppt' || ext === '.pptx') {
    throw new Error('Para PowerPoint usa una copia exportada a PDF por ahora.');
  }

  if (ext === '.pdf' || file.type === 'application/pdf') {
    return extractPdf(file);
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

  throw new Error('Todavía no sé leer este formato. Prueba con PDF, DOCX, TXT o Markdown.');
}
