# 🐾 Study Paws (V0)

PWA mobile-first para estudiar (pensada para Medicina): materias, unidades, clases,
archivos adjuntos y guías de estudio. Esta versión **no usa IA ni backend**:
todo se guarda en tu dispositivo y funciona offline tras la primera carga.

## Funciones V0.2
- Presets de estudio: Medicina Interna (Materia), Medicina Interna (Práctica) y Farmacología
- Interfaz visual refinada y tarjetas de presets adaptables al móvil

## Funciones V0
- Dashboard de materias (crear, renombrar, eliminar)
- Unidades y clases dentro de cada materia, con check de "estudiada"
- Archivos por clase, clasificados como PPT / transcripción / guía / libro / otro
- "Crear guía" con 7 modos (completa, diapositiva por diapositiva, repaso rápido,
  puntos clave, trampas, preguntas, casos clínicos) usando **contenido demo**
- Guías y borradores guardados localmente, editables, copiables e imprimibles
- Progreso (porcentaje, racha, actividad semanal, avance por materia)
- Modo claro / oscuro / automático
- Instalable y offline

## Probar en local
Los service workers y módulos ES requieren servidor (no abras el HTML con doble clic):

```bash
cd study-paws
python3 -m http.server 8080
# abre http://localhost:8080
```

## Publicar en GitHub Pages
1. Sube la carpeta a un repositorio (los archivos deben quedar en la raíz del repo o en `/docs`).
2. En GitHub: **Settings → Pages → Deploy from a branch**, elige la rama y `/ (root)` (o `/docs`).
3. Abre `https://TU-USUARIO.github.io/NOMBRE-REPO/`.

Todas las rutas son relativas y el router usa `#/`, así que funciona en subcarpetas sin configuración extra.

## Instalar como app
- **Android (Chrome):** menú ⋮ → *Instalar app* (o el botón en Ajustes).
- **Escritorio (Chrome/Edge):** icono de instalar en la barra de direcciones.
- **iOS (Safari):** Compartir → *Añadir a pantalla de inicio*.

## Estructura
| Archivo | Responsabilidad |
|---|---|
| `index.html` | Esqueleto, nav, diálogo y toast |
| `css/app.css` | Tema cuaderno, claro/oscuro, responsive |
| `js/app.js` | Router por hash + todas las vistas |
| `js/ui.js` | Helper `h()`, markdown mínimo, diálogos, toast, gatito |
| `js/storage.js` | Estado en localStorage + blobs en IndexedDB |
| `js/subjects.js` | Materias / unidades / clases |
| `js/files.js` | Adjuntos y tipos de archivo |
| `js/guides.js` | Modos, proveedores de contenido, guardado |
| `sw.js` | Caché offline |

## Modelo de datos (localStorage `studypaws:v1`)
```
subjects[]: { id, name, emoji, color, units[]: { id, name, lessons[]:
              { id, name, done, files[]: { id, name, size, mime, type } } } }
guides[]:   { id, title, content(markdown), mode, status: 'draft'|'saved',
              subjectId, unitId, lessonId, createdAt, updatedAt }
settings:   { theme: 'auto'|'light'|'dark' }
progress:   { log: { 'YYYY-MM-DD': n } }
```
El contenido de los archivos vive en IndexedDB (`studypaws-files`), indexado por `file.id`.

## Cómo añadir IA y backend más adelante
La generación pasa por un **contrato de proveedor** en `js/guides.js`:

```js
registerProvider({
  id: 'mi-backend',
  label: 'Mi backend',
  async generate(request) {
    // request: { mode, depth, options, subject, unit, lesson, files:[{name,type}] }
    const res = await fetch('https://TU-BACKEND/api/guides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    if (!res.ok) throw new Error('Error del backend');
    return res.json(); // { title, content } con content en Markdown
  }
});
setActiveProvider('mi-backend');
```
Recomendaciones:
- **Nunca** pongas API keys en el frontend: llama a tu propio backend y guarda las claves allí.
- Para enviar el contenido de los archivos, súbelos al backend (multipart) o extrae texto en el cliente antes.
- Para sincronizar datos, reimplementa las funciones de `storage.js` (`update`, `getState`, `putBlob`…) contra tu API.
- Un selector de proveedor puede añadirse en `settingsView()` de `app.js`.

## Notas y límites conocidos
- **Iconos:** se incluyen SVG (válidos en Chrome/Edge/Android). Para máxima compatibilidad
  (sobre todo iOS) genera `icon-192.png`, `icon-512.png` y `apple-touch-icon.png` (180×180)
  a partir de `assets/icons/icon.svg`, añádelos al `manifest.webmanifest` **y** a `ASSETS` en `sw.js`
  (si un archivo listado no existe, el service worker no se instala).
- **Actualizaciones:** al desplegar cambios, sube `VERSION` en `sw.js`. Los usuarios verán la versión nueva en la siguiente carga.
- **Datos locales:** si el usuario borra los datos del navegador, se pierden. Por eso existe Exportar/Importar
  (la copia no incluye los archivos adjuntos).
- Los archivos grandes ocupan el espacio del navegador; el panel de Ajustes muestra el uso.

## Roadmap sugerido
1. Probar V0 y pulir la UI.
2. Extraer texto de PDF/PPT en el cliente.
3. Backend + proveedor de IA real.
4. Repetición espaciada con las preguntas generadas.
5. Cuentas y sincronización.

---

🚀 Study Paws V0 publicada desde el repositorio oficial.


## Study Paws Brain V1

Study Paws V0.4 separa la inteligencia que no necesita IA:

- Brain global de aprendizaje.
- Perfiles para Medicina Interna (materia), Medicina Interna (práctica) y Farmacología.
- Política de fuentes: automático / núcleo / apoyo / no usar.
- Estado de dominio separado: comprender / recordar / aplicar / defender.
- Estimación previa de contexto y tokens.
- División automática en bloques para PDFs largos.
- Constructor de paquete para la futura API.

La futura IA no tendrá que decidir desde cero cómo enseñar ni qué documentos usar: recibirá una tarea ya estructurada.


## Smart Class Engine V0.5

La PWA prepara el contexto antes de usar IA:

- indexa localmente PDFs, DOCX y texto;
- conserva página/diapositiva y procedencia;
- detecta parejas presentación ↔ transcripción dentro de una clase;
- recupera solo fragmentos relevantes para una pregunta;
- en modo diapositiva por diapositiva modela bloques reales de ~5 slides;
- muestra un Context Inspector sin consumir API;
- el futuro prompt builder recibe fragmentos seleccionados, no documentos completos por defecto.

El índice y la recuperación funcionan localmente en el navegador.


## Deep Alignment V0.5.1

Smart Class ahora puede construir y guardar un mapa local:

- diapositiva/página → fragmentos relevantes de la transcripción;
- confianza alta / media / baja por vínculo;
- orden secuencial favorecido para respetar el avance real de la clase;
- fragmentos de transcripción más finos para una alineación más precisa;
- mapa visible antes de gastar API;
- Context Inspector prioriza la transcripción ya alineada con cada slide;
- índices y alineaciones antiguos se regeneran automáticamente cuando cambia el algoritmo.


## Secure AI Pipeline V0.6

La PWA ya tiene preparada la ruta de IA real sin exponer la API key:

- frontend público sin `OPENAI_API_KEY`;
- backend Cloudflare Worker separado;
- OpenAI Responses API;
- token personal revocable para proteger el backend público;
- generación por bloques de ~5 diapositivas;
- guardado automático después de cada bloque;
- detener / continuar / reintentar desde el bloque fallido;
- Context Inspector y Smart Class antes de cada llamada;
- trabajos recientes limitados y contexto completado descartado para no inflar localStorage;
- token del backend guardado aparte y excluido de los backups.

El backend está en `backend/`. No contiene secretos reales.


## Safe First Test V0.6.1

Antes de permitir una generación completa diapositiva-por-diapositiva:

- Study Paws obliga a ejecutar una prueba de **un solo bloque (slides 1–5)**;
- realiza exactamente una llamada de generación;
- muestra tokens de entrada, salida y total devueltos por la API;
- no envía automáticamente las slides 6 en adelante;
- conserva el resultado de la prueba;
- la generación completa permanece bloqueada hasta que la usuaria revise el resultado y pulse **“Está bien — desbloquear clase completa”**;
- el test puede repetirse y vuelve a bloquear la generación completa hasta una nueva aprobación.

Esto reduce gasto accidental y permite validar el Brain y la calidad del prompt antes de procesar una clase completa.
