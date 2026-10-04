# Study Paws AI backend

Backend personal para que la PWA pública use IA sin exponer la clave de OpenAI.

## Arquitectura actual

Study Paws PWA → token personal → Vercel Function → `OPENAI_API_KEY` secreta → OpenAI Responses API.

La PWA **nunca recibe ni guarda** `OPENAI_API_KEY`.

## Vercel

Este directorio está preparado para desplegarse como proyecto Vercel usando `backend/` como **Root Directory**.

Rutas públicas:

- `GET /health`
- `POST /v1/generate`

Internamente Vercel las reescribe a las funciones de `api/`.

## Variables requeridas en Vercel

Secretas:

- `OPENAI_API_KEY`
- `STUDY_PAWS_ACCESS_TOKEN`

No secreta / configurable:

- `OPENAI_MODEL` — por defecto `gpt-6.1-sol`
- `REASONING_EFFORT` — por defecto `medium`
- `ALLOWED_ORIGIN` — por defecto `https://justacheeseondrugs-cmd.github.io`

Nunca pongas los secretos en GitHub, `.env`, la PWA ni un backup compartido.

## Seguridad incluida

- CORS restringido al origen de GitHub Pages.
- token personal obligatorio incluso para `/health`.
- OpenAI API key solo en Vercel.
- límite de tamaño del request.
- máximo de salida por bloque.
- `store:false` en Responses API.
- fuentes tratadas como datos, no como instrucciones.
- el frontend no acepta ni envía una API key de OpenAI.
- generación por bloques reanudable del lado de Study Paws.

## Despliegue

1. Conecta este repositorio a Vercel.
2. Usa `backend` como Root Directory.
3. Configura las variables de entorno directamente en Vercel.
4. Despliega.
5. Copia la URL `https://...vercel.app`.
6. En Study Paws abre **Ajustes → IA segura**.
7. Guarda la URL y el mismo `STUDY_PAWS_ACCESS_TOKEN`.
8. Pulsa **Probar conexión**.

El antiguo `worker.js` y `wrangler.jsonc` se conservan como alternativa Cloudflare, pero Vercel es la ruta principal actual.
