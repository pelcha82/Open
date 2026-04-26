export class PocketModelRuntime {
  constructor(logger = () => {}) {
    this.loaded = false;
    this.mode = 'mock';
    this.modelName = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
    this.logger = logger;
    this.webllm = null;
    this.engine = null;
  }

  supportsWebGPU() {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  async load({ mode, modelName, onProgress = () => {} }) {
    this.mode = mode;
    this.modelName = modelName;

    if (mode === 'mock') {
      await new Promise(r => setTimeout(r, 400));
      this.loaded = true;
      return {
        ramEstimate: '1.2 GB',
        backend: 'mock'
      };
    }

    if (!this.supportsWebGPU()) {
      throw new Error('Este navegador no soporta WebGPU. En iPhone necesitas Safari/iOS compatible.');
    }

    if (!this.webllm) {
      this.logger('Cargando WebLLM desde CDN...');
      this.webllm = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm');
    }

    onProgress('Preparando motor WebLLM...');
    this.logger(`Inicializando modelo real: ${modelName}`);

    this.engine = await this.webllm.CreateMLCEngine(modelName, {
      initProgressCallback: info => {
        const text = `${info.text ?? 'Cargando'} ${typeof info.progress === 'number' ? Math.round(info.progress * 100) + '%' : ''}`.trim();
        onProgress(text);
        this.logger(text);
      }
    });

    this.loaded = true;
    return {
      ramEstimate: '2.4 GB+',
      backend: 'webllm'
    };
  }

  async stop() {
    if (this.engine?.unload) {
      try {
        await this.engine.unload();
      } catch (_) {}
    }
    this.engine = null;
    this.loaded = false;
  }

  async generate({ prompt, temperature, maxTokens }) {
    if (!this.loaded) throw new Error('Modelo no cargado');
    const started = performance.now();

    if (this.mode === 'webllm' && this.engine) {
      const reply = await this.engine.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens
      });
      const latency = (performance.now() - started) / 1000;
      const text = reply.choices?.[0]?.message?.content || 'Sin respuesta del modelo.';
      const usage = reply.usage || {
        prompt_tokens: Math.max(18, Math.round(prompt.length / 4)),
        completion_tokens: Math.max(24, Math.round(text.length / 5)),
        total_tokens: 0
      };
      if (!usage.total_tokens) {
        usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
      }
      return { text, latency, usage };
    }

    await new Promise(r => setTimeout(r, 900));
    const latency = (performance.now() - started) / 1000;
    const text = `Respuesta mock local para: ${prompt.slice(0, 180)}\n\nSiguiente paso: integrar o usar el modo WebLLM en un navegador compatible.`;
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
