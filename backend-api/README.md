# PocketModel Web Bridge

Puente HTTP para que un cliente externo (por ejemplo OpenClaw) envíe prompts al modelo que está corriendo dentro del navegador.

## Qué hace

1. La app web registra una sesión y obtiene/reutiliza un token.
2. El navegador abre un canal SSE hacia este backend.
3. Un cliente externo llama `POST /v1/chat/completions` con `Authorization: Bearer <token>`.
4. El backend reenvía la solicitud al navegador activo.
5. El navegador ejecuta el modelo y devuelve el resultado.

## Variables de entorno

- `PORT` puerto del servicio (default `3000`)
- `ALLOWED_ORIGIN` origen permitido para CORS (default `*`)

## Ejecutar

```bash
npm install
PORT=3101 ALLOWED_ORIGIN=https://open-one-phi.vercel.app npm start
```

## Endpoints

- `GET /health`
- `POST /v1/session/register`
- `GET /v1/session/events?token=...`
- `POST /v1/session/result`
- `GET /v1/models`
- `POST /v1/chat/completions`

## Ejemplo de uso

```bash
curl -X POST https://TU_BACKEND/v1/chat/completions \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hola"}],
    "temperature": 0.7,
    "max_tokens": 256
  }'
```

## Nota

El navegador debe permanecer abierto y con el bridge activo. Si el navegador se desconecta, la API responderá con error `409 navegador desconectado`.
