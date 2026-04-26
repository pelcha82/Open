# PocketModel Web

MVP web local-first para correr una experiencia de modelo en navegador sin depender de Mac/Xcode.

## Qué hace esta versión
- UI web responsive
- PWA básica
- runtime mock local
- modo preparado para futura integración WebLLM / WebGPU
- API virtual en navegador para el flujo de prueba

## Cómo abrirlo localmente
```bash
python3 -m http.server 8010 -d /data/.openclaw/workspace/PocketModelWeb
```
Luego abre:
```text
http://TU_SERVIDOR:8010
```

## Próximo paso técnico
Integrar runtime real en navegador, por ejemplo:
- WebLLM
- Transformers.js
- ONNX Web

## Deploy recomendado
- GitHub + Vercel
- Netlify
- Cloudflare Pages
