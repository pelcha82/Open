export class PocketModelRuntime {
  constructor() {
    this.loaded = false;
    this.mode = 'mock';
    this.modelName = 'PocketModel Local';
  }

  async load({ mode, modelName }) {
    this.mode = mode;
    this.modelName = modelName;
    await new Promise(r => setTimeout(r, 600));
    this.loaded = true;
    return { ramEstimate: mode === 'webllm' ? '2.4 GB' : '1.2 GB' };
  }

  async stop() {
    this.loaded = false;
  }

  async generate({ prompt, temperature, maxTokens }) {
    if (!this.loaded) throw new Error('Modelo no cargado');
    const started = performance.now();
    await new Promise(r => setTimeout(r, 900));
    const latency = (performance.now() - started) / 1000;
    const text = this.mode === 'webllm'
      ? `Modo WebLLM listo para integrar. Prompt recibido: ${prompt.slice(0, 140)}`
      : `Respuesta mock local para: ${prompt.slice(0, 180)}\n\nSiguiente paso: integrar un runtime real de navegador (WebGPU/WebLLM o Transformers.js).`;
    const promptTokens = Math.max(18, Math.round(prompt.length / 4));
    const completionTokens = Math.min(maxTokens, Math.max(48, Math.round(text.length / 5)));
    return {
      text,
      latency,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      }
    };
  }
}