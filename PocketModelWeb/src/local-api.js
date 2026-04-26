function randomToken() {
  if (globalThis.crypto?.randomUUID) return `pmw_${globalThis.crypto.randomUUID()}`;
  return `pmw_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export class LocalAPIController {
  constructor(runtime, logger) {
    this.runtime = runtime;
    this.logger = logger;
    this.active = false;
    this.bridgeBaseUrl = '';
    this.token = '';
    this.eventSource = null;
  }

  configure({ bridgeBaseUrl, token }) {
    this.bridgeBaseUrl = (bridgeBaseUrl || '').trim().replace(/\/$/, '');
    this.token = (token || '').trim();
  }

  getConnectionInfo() {
    return {
      endpoint: this.bridgeBaseUrl ? `${this.bridgeBaseUrl}/v1/chat/completions` : '/v1/chat/completions',
      token: this.token
    };
  }

  async start({ bridgeBaseUrl, token, model, mode }) {
    this.configure({ bridgeBaseUrl, token: token || this.token || randomToken() });
    if (!this.bridgeBaseUrl) {
      throw new Error('Falta Bridge URL');
    }

    const res = await fetch(`${this.bridgeBaseUrl}/v1/session/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: this.token,
        model,
        mode,
        userAgent: navigator.userAgent
      })
    });

    if (!res.ok) {
      throw new Error(`No se pudo registrar la sesión (${res.status})`);
    }

    const data = await res.json();
    this.token = data.token;
    this.active = true;
    this.logger(`Bridge activo. Token: ${this.token}`);
    this.connectEvents();
    return data;
  }

  connectEvents() {
    this.eventSource?.close();
    this.eventSource = new EventSource(`${this.bridgeBaseUrl}/v1/session/events?token=${encodeURIComponent(this.token)}`);

    this.eventSource.addEventListener('ready', () => {
      this.logger('Canal remoto listo');
    });

    this.eventSource.addEventListener('completion_request', async event => {
      try {
        const payload = JSON.parse(event.data);
        this.logger(`Solicitud remota recibida: ${payload.requestId}`);
        const result = await this.runtime.generate({
          prompt: payload.prompt,
          temperature: Number(payload.temperature ?? 0.7),
          maxTokens: Number(payload.maxTokens ?? 512)
        });

        await fetch(`${this.bridgeBaseUrl}/v1/session/result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: this.token, requestId: payload.requestId, result })
        });
      } catch (error) {
        const payload = (() => {
          try { return JSON.parse(event.data); } catch { return {}; }
        })();
        if (payload.requestId) {
          await fetch(`${this.bridgeBaseUrl}/v1/session/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: this.token, requestId: payload.requestId, error: error.message })
          });
        }
        this.logger(`Error remoto: ${error.message}`);
      }
    });

    this.eventSource.onerror = () => {
      this.logger('Conexión remota interrumpida; reintentando automáticamente');
    };
  }

  stop() {
    this.active = false;
    this.eventSource?.close();
    this.eventSource = null;
    this.logger('Bridge detenido');
  }

  async chatCompletion({ prompt, temperature, maxTokens }) {
    return this.runtime.generate({ prompt, temperature, maxTokens });
  }
}
