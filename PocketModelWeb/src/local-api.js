export class LocalAPIController {
  constructor(runtime, logger) {
    this.runtime = runtime;
    this.logger = logger;
    this.active = false;
  }

  start() {
    this.active = true;
    this.logger('API virtual activada en navegador');
  }

  stop() {
    this.active = false;
    this.logger('API virtual detenida');
  }

  async chatCompletion({ prompt, temperature, maxTokens }) {
    return this.runtime.generate({ prompt, temperature, maxTokens });
  }
}