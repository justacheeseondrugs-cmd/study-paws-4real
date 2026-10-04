# Study Paws AI backend

Backend personal para que la PWA pública pueda usar IA sin exponer la clave de OpenAI.

## Arquitectura

Study Paws PWA -> token de acceso personal -> Cloudflare Worker -> OPENAI_API_KEY secreta -> OpenAI Responses API.

La PWA **nunca recibe ni guarda** `OPENAI_API_KEY`.

## Secretos requeridos

- `OPENAI_API_KEY`
- `STUDY_PAWS_ACCESS_TOKEN`

Guárdalos como **Cloudflare Secrets**, nunca en `wrangler.jsonc`, JavaScript público, GitHub Actions visibles ni archivos de backup.

El token de Study Paws NO es tu API key de OpenAI. Es una contraseña revocable para impedir que otras personas que descarguen la PWA gasten tus créditos usando tu Worker.

## Variables no secretas

- `ALLOWED_ORIGIN`
- `OPENAI_MODEL`
- `REASONING_EFFORT`

## Seguridad incluida

- CORS limitado al origen de GitHub Pages.
- Token personal obligatorio.
- API key solo del lado servidor.
- límite de tamaño de request.
- límite de salida por bloque.
- `store:false` en Responses API.
- las fuentes se delimitan como datos y no como instrucciones.
- no se acepta una API key enviada desde el frontend.

## Antes de desplegar

1. Crea el Worker.
2. Configura los dos secretos en el dashboard o con Wrangler.
3. Despliega.
4. Copia la URL del Worker en Study Paws -> Ajustes -> IA.
5. Ingresa el token personal que configuraste en el Worker.
6. Usa "Probar conexión".
