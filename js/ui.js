// Utilidades de interfaz: creación de DOM, markdown mínimo, diálogos, toast y gatito.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** h('div', {class:'x', onClick: fn}, ...hijos) */
export function h(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return node;
}

/** Markdown mínimo y seguro (escapa HTML primero). */
export function md(src = '') {
  const inline = (t) => t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');
  let out = '';
  let list = null;
  const close = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const raw of esc(src).split('\n')) {
    const l = raw.trimEnd();
    let m;
    if (!l.trim()) { close(); continue; }
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) { close(); const n = m[1].length + 1; out += `<h${n}>${inline(m[2])}</h${n}>`; }
    else if ((m = l.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^&gt;\s?(.*)/))) { close(); out += `<blockquote>${inline(m[1])}</blockquote>`; }
    else { close(); out += `<p>${inline(l)}</p>`; }
  }
  close();
  return out;
}

/* ---------- Toast ---------- */
let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

/* ---------- Diálogos ---------- */
const dlg = () => document.getElementById('dlg');

export function promptDialog({ title, label = '', value = '', confirm = 'Guardar' }) {
  return new Promise((resolve) => {
    const d = dlg();
    let result = null;
    const input = h('input', { type: 'text', value, required: true, maxlength: 80, autocomplete: 'off', placeholder: label, 'aria-label': title });
    const form = h('form', { method: 'dialog', class: 'dlg-form' },
      h('h3', {}, title),
      input,
      h('div', { class: 'dlg-actions' },
        h('button', { type: 'button', class: 'btn ghost', onClick: () => d.close() }, 'Cancelar'),
        h('button', { type: 'submit', class: 'btn' }, confirm)));
    form.addEventListener('submit', () => { result = input.value.trim() || null; });
    d.addEventListener('close', () => resolve(result), { once: true });
    d.replaceChildren(form);
    d.showModal();
    input.focus();
    input.select();
  });
}

export function confirmDialog({ title, text = '', confirm = 'Aceptar', danger = false }) {
  return new Promise((resolve) => {
    const d = dlg();
    let ok = false;
    const form = h('form', { method: 'dialog', class: 'dlg-form' },
      h('h3', {}, title),
      text ? h('p', { class: 'muted' }, text) : null,
      h('div', { class: 'dlg-actions' },
        h('button', { type: 'button', class: 'btn ghost', onClick: () => d.close() }, 'Cancelar'),
        h('button', { type: 'submit', class: `btn${danger ? ' danger' : ''}` }, confirm)));
    form.addEventListener('submit', () => { ok = true; });
    d.addEventListener('close', () => resolve(ok), { once: true });
    d.replaceChildren(form);
    d.showModal();
  });
}

/* ---------- Mascota: gatito negro ---------- */
export function catSvg() {
  return `<svg class="cat" viewBox="0 0 80 80" role="img" aria-label="Gatito negro">
    <path d="M14 36 L17 8 L36 25 Z" fill="var(--cat)" stroke="var(--cat-line)" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M66 36 L63 8 L44 25 Z" fill="var(--cat)" stroke="var(--cat-line)" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M19 15 L22 25 L29 23 Z" fill="#f4a9b8"/>
    <path d="M61 15 L58 25 L51 23 Z" fill="#f4a9b8"/>
    <ellipse cx="40" cy="46" rx="29" ry="25" fill="var(--cat)" stroke="var(--cat-line)" stroke-width="1.5"/>
    <ellipse cx="29" cy="43" rx="5" ry="6" fill="#f6e7a1"/>
    <ellipse cx="51" cy="43" rx="5" ry="6" fill="#f6e7a1"/>
    <ellipse cx="29" cy="43" rx="1.8" ry="5" fill="#1d1820"/>
    <ellipse cx="51" cy="43" rx="1.8" ry="5" fill="#1d1820"/>
    <circle cx="30.5" cy="41" r="1.2" fill="#fff"/><circle cx="52.5" cy="41" r="1.2" fill="#fff"/>
    <path d="M37 52 h6 l-3 4 z" fill="#f4a9b8"/>
    <path d="M40 56 q-3 4 -7 2 M40 56 q3 4 7 2" stroke="#f4a9b8" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="54" r="4" fill="#f4a9b8" opacity=".55"/><circle cx="60" cy="54" r="4" fill="#f4a9b8" opacity=".55"/>
    <path d="M14 48 h-9 M14 52 l-8 3 M66 48 h9 M66 52 l8 3" stroke="#f4a9b8" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
}
