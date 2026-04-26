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
  webgpuValue: $('#webgpuValue'),
  latencyValue: $('#latencyValue'),
  metrics: $('#metrics'),
  chatLog: $('#chatLog'),
  promptInput: $('#promptInput'),
  sendPromptBtn: $('#sendPromptBtn'),
  clearChatBtn: $('#clearChatBtn'),
  logBox: $('#logBox')
};

const log = message => {
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  els.logBox.prepend(line);
};

const runtime = new PocketModelRuntime(log);
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
function setBusy(isBusy) {
  els.loadModelBtn.disabled = isBusy;
  els.sendPromptBtn.disabled = isBusy;
  els.loadModelBtn.textContent = isBusy ? 'Cargando...' : 'Cargar modelo';
}
function updateApiFields() {
  const info = api.getConnectionInfo();
  els.apiEndpoint.value = info.endpoint;
  els.apiToken.value = info.token;
}

els.temperature.addEventListener('input', () => {
  els.temperatureValue.textContent = els.temperature.value;
});

els.loadModelBtn.addEventListener('click', async () => {
  setBusy(true);
  try {
    const mode = els.modeSelect.value;
    const modelName = els.modelName.value.trim() || 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
    const result = await runtime.load({
      mode,
      modelName,
      onProgress: text => setModelStatus(false, text)
    });
    els.modelValue.textContent = modelName;
    els.modeValue.textContent = mode;
    els.ramValue.textContent = result.ramEstimate;
    setModelStatus(true, `Modelo cargado (${result.backend})`);
    log(`Modelo cargado: ${modelName} en modo ${mode}`);
  } catch (err) {
    setModelStatus(false, 'Error cargando modelo');
    log(`Error cargando modelo: ${err.message}`);
    addMessage('assistant', `Error cargando modelo: ${err.message}`);
  } finally {
    setBusy(false);
  }
});

els.stopModelBtn.addEventListener('click', async () => {
  await runtime.stop();
  setModelStatus(false, 'Modelo detenido');
  log('Modelo detenido');
});

els.toggleApiBtn.addEventListener('click', async () => {
  if (api.active) {
    api.stop();
    setApiStatus(false, 'Bridge apagado');
    els.toggleApiBtn.textContent = 'Activar bridge';
    updateApiFields();
    return;
  }

  try {
    const bridgeBaseUrl = window.prompt('Bridge URL (backend)', window.location.origin) || window.location.origin;
    const token = els.apiToken.value.trim();
    const model = els.modelName.value.trim() || 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
    const mode = els.modeSelect.value;
    await api.start({ bridgeBaseUrl, token, model, mode });
    setApiStatus(true, 'Bridge remoto activo');
    els.toggleApiBtn.textContent = 'Detener bridge';
    updateApiFields();
  } catch (err) {
    setApiStatus(false, 'Error activando bridge');
    log(`Error activando bridge: ${err.message}`);
    addMessage('assistant', `Error activando bridge: ${err.message}`);
  }
});

els.copyConfigBtn.addEventListener('click', async () => {
  const info = api.getConnectionInfo();
  const payload = JSON.stringify({
    endpoint: info.endpoint,
    token: info.token,
    model: els.modelName.value,
    exampleCurl: `curl -X POST ${info.endpoint} -H \"Authorization: Bearer ${info.token}\" -H \"Content-Type: application/json\" -d '{\"messages\":[{\"role\":\"user\",\"content\":\"Hola\"}]}'`
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

const webgpuAvailable = runtime.supportsWebGPU();
els.webgpuValue.textContent = webgpuAvailable ? 'Disponible' : 'No disponible';
addMessage('assistant', webgpuAvailable
  ? 'PocketModel Web listo. Puedes probar mock o intentar WebLLM si tu navegador soporta WebGPU.'
  : 'PocketModel Web listo. Tu navegador actual no expone WebGPU; usa mock o prueba Safari/iOS compatible para modo real.');
log(`Aplicación inicializada. WebGPU: ${webgpuAvailable ? 'sí' : 'no'}`);
updateApiFields();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
