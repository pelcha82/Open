# PocketModel Web

MVP web local-first para correr una experiencia de modelo en navegador sin depender de Mac/Xcode.

## Qué hace esta versión
- UI web responsive
- PWA básica
- runtime mock local
- integración inicial real con WebLLM vía CDN
- API virtual en navegador para el flujo de prueba

## Cómo abrirlo localmente
```bash
python3 -m http.server 8010 -d /data/.openclaw/workspace/PocketModelWeb
```
Luego abre:
```text
http://TU_SERVIDOR:8010
```

## Runtime real
El modo `WebLLM / navegador` intenta cargar un modelo real en navegadores compatibles con WebGPU.

Modelo inicial sugerido:
- `Llama-3.2-1B-Instruct-q4f32_1-MLC`

Si el navegador no soporta WebGPU, el modo real fallará con mensaje claro y seguirá disponible el modo mock.

## Próximo paso técnico
Mejorar compatibilidad y catálogo de modelos, por ejemplo:
- WebLLM
- Transformers.js
- ONNX Web

## Deploy recomendado
- GitHub + Vercel
- Netlify
- Cloudflare Pages
