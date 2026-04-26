import { PocketModelRuntime } from './runtime.js';
import { LocalAPIController } from './local-api.js';

const $ = sel => document.querySelector(sel);
const els = {
  modeSelect: $('#modeSelect'),
  modelName: $('#modelName'),
  temperature: $('#temperature'),
  temperatureValue: $('#temperatureValue'),
  maxTokens: $('#maxTokens'),
  loadModelBtn: $('#loadModelBtn'),
  stopModelBtn: $('#stopModelBtn'),
  toggleApiBtn: $('#toggleApiBtn'),
  copyConfigBtn: $('#copyConfigBtn'),
  apiEndpoint: $('#apiEndpoint'),
  apiToken: $('#apiToken'),
  modelStatus: $('#modelStatus'),
  apiStatus: $('#apiStatus'),
  modelValue: $('#modelValue'),
  modeValue: $('#modeValue'),
  ramValue: $('#ramValue'),
  latencyValue: $('#latencyValue'),
  metrics: $('#metrics'),
  chatLog: $('#chatLog'),
  promptInput: $('#promptInput'),
  sendPromptBtn: $('#sendPromptBtn'),
  clearChatBtn: $('#clearChatBtn'),
  logBox: $('#logBox')
};

const runtime = new PocketModelRuntime();
const log = message => {
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  els.logBox.prepend(line);
};
const api = new LocalAPIController(runtime, log);

function setModelStatus(ok, text) {
  els.modelStatus.textContent = text;
  els.modelStatus.className = `pill ${ok ? 'ok' : 'idle'}`;
}
function setApiStatus(ok, text) {
  els.apiStatus.textContent = text;
  els.apiStatus.className = `pill ${ok ? 'ok' : 'idle'}`;
}
function addMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = content;
  els.chatLog.appendChild(div);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
}

els.temperature.addEventListener('input', () => {
  els.temperatureValue.textContent = els.temperature.value;
});

els.loadModelBtn.addEventListener('click', async () => {
  try {
    const mode = els.modeSelect.value;
    const modelName = els.modelName.value.trim() || 'PocketModel Local';
    const result = await runtime.load({ mode, modelName });
    els.modelValue.textContent = modelName;
    els.modeValue.textContent = mode;
    els.ramValue.textContent = result.ramEstimate;
    setModelStatus(true, `Modelo cargado (${mode})`);
    log(`Modelo cargado: ${modelName} en modo ${mode}`);
  } catch (err) {
    log(`Error cargando modelo: ${err.message}`);
  }
});

els.stopModelBtn.addEventListener('click', async () => {
  await runtime.stop();
  setModelStatus(false, 'Modelo detenido');
  log('Modelo detenido');
});

els.toggleApiBtn.addEventListener('click', () => {
  if (api.active) {
    api.stop();
    setApiStatus(false, 'API apagada');
    els.toggleApiBtn.textContent = 'Activar API';
  } else {
    api.start();
    setApiStatus(true, 'API virtual activa');
    els.toggleApiBtn.textContent = 'Detener API';
  }
});

els.copyConfigBtn.addEventListener('click', async () => {
  const payload = JSON.stringify({
    endpoint: els.apiEndpoint.value,
    token: els.apiToken.value,
    model: els.modelName.value
  }, null, 2);
  await navigator.clipboard.writeText(payload);
  log('Configuración copiada al portapapeles');
});

els.sendPromptBtn.addEventListener('click', async () => {
  const prompt = els.promptInput.value.trim();
  if (!prompt) return;
  addMessage('user', prompt);
  els.promptInput.value = '';
  try {
    const result = await api.chatCompletion({
      prompt,
      temperature: Number(els.temperature.value),
      maxTokens: Number(els.maxTokens.value)
    });
    addMessage('assistant', result.text);
    els.metrics.textContent = `${result.usage.total_tokens} tokens · ${result.latency.toFixed(1)}s`;
    els.latencyValue.textContent = `${result.latency.toFixed(1)}s`;
    log('Prompt procesado correctamente');
  } catch (err) {
    addMessage('assistant', `Error: ${err.message}`);
    log(`Error procesando prompt: ${err.message}`);
  }
});

els.clearChatBtn.addEventListener('click', () => {
  els.chatLog.innerHTML = '';
  log('Chat limpiado');
});

addMessage('assistant', 'PocketModel Web listo. Carga el modelo y prueba un prompt.');
log('Aplicación inicializada');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
