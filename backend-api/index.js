const express = require('express');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 3000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

const sessions = new Map();
const pendingRequests = new Map();

function now() {
  return Date.now();
}

function makeId(prefix = 'id') {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function getSession(token) {
  return sessions.get(token);
}

function ensureSession(token) {
  let session = sessions.get(token);
  if (!session) {
    session = {
      token,
      createdAt: now(),
      lastSeenAt: now(),
      clientMeta: null,
      browserOnline: false,
      eventStream: null,
      queue: []
    };
    sessions.set(token, session);
  }
  session.lastSeenAt = now();
  return session;
}

function enqueueEvent(session, event) {
  if (session.eventStream) {
    session.eventStream.write(`event: ${event.type}\n`);
    session.eventStream.write(`data: ${JSON.stringify(event.data)}\n\n`);
    return;
  }
  session.queue.push(event);
}

function flushQueue(session) {
  if (!session.eventStream) return;
  while (session.queue.length > 0) {
    const event = session.queue.shift();
    session.eventStream.write(`event: ${event.type}\n`);
    session.eventStream.write(`data: ${JSON.stringify(event.data)}\n\n`);
  }
}

app.get('/', (_req, res) => {
  res.json({
    name: 'PocketModel Web Bridge',
    ok: true,
    endpoints: ['/health', '/v1/session/register', '/v1/session/events', '/v1/session/result', '/v1/models', '/v1/chat/completions']
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, sessions: sessions.size, pending: pendingRequests.size });
});

app.post('/v1/session/register', (req, res) => {
  const providedToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const token = providedToken || makeId('pmw');
  const session = ensureSession(token);
  session.clientMeta = {
    model: req.body?.model || null,
    mode: req.body?.mode || null,
    userAgent: req.body?.userAgent || null
  };
  session.browserOnline = true;
  res.json({
    ok: true,
    token,
    bridgeUrl: `${req.protocol}://${req.get('host')}`,
    session: {
      browserOnline: session.browserOnline,
      model: session.clientMeta.model,
      mode: session.clientMeta.mode,
      lastSeenAt: session.lastSeenAt
    }
  });
});

app.get('/v1/session/events', (req, res) => {
  const token = String(req.query.token || '').trim();
  if (!token) return res.status(400).json({ error: 'token requerido' });

  const session = getSession(token);
  if (!session) return res.status(404).json({ error: 'sesión no encontrada' });

  session.browserOnline = true;
  session.lastSeenAt = now();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  session.eventStream = res;
  enqueueEvent(session, { type: 'ready', data: { ok: true, token } });
  flushQueue(session);

  const heartbeat = setInterval(() => {
    session.lastSeenAt = now();
    if (session.eventStream) {
      session.eventStream.write(`event: ping\n`);
      session.eventStream.write(`data: ${JSON.stringify({ now: now() })}\n\n`);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    if (session.eventStream === res) {
      session.eventStream = null;
      session.browserOnline = false;
    }
  });
});

app.post('/v1/session/result', (req, res) => {
  const token = String(req.body?.token || '').trim();
  const requestId = String(req.body?.requestId || '').trim();
  const result = req.body?.result;
  const error = req.body?.error;

  if (!token || !requestId) {
    return res.status(400).json({ error: 'token y requestId requeridos' });
  }

  const pending = pendingRequests.get(requestId);
  if (!pending || pending.token !== token) {
    return res.status(404).json({ error: 'request pendiente no encontrado' });
  }

  clearTimeout(pending.timeout);
  pendingRequests.delete(requestId);

  if (error) {
    pending.reject(new Error(typeof error === 'string' ? error : 'Error remoto'));
  } else {
    pending.resolve(result);
  }

  res.json({ ok: true });
});

app.get('/v1/models', (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Bearer token requerido' });

  const session = getSession(token);
  if (!session) return res.status(404).json({ error: 'sesión no encontrada' });

  res.json({
    object: 'list',
    data: [
      {
        id: session.clientMeta?.model || 'browser-model',
        object: 'model',
        owned_by: 'pocketmodel-web',
        browser_online: session.browserOnline
      }
    ]
  });
});

app.post('/v1/chat/completions', async (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Bearer token requerido' });

  const session = getSession(token);
  if (!session) return res.status(404).json({ error: 'sesión no encontrada' });
  if (!session.browserOnline) return res.status(409).json({ error: 'navegador desconectado' });

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const lastUserMessage = [...messages].reverse().find(m => m?.role === 'user');
  const prompt = lastUserMessage?.content;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'messages con último role=user requerido' });
  }

  const requestId = makeId('req');

  const resultPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('timeout esperando respuesta del navegador'));
    }, 120000);

    pendingRequests.set(requestId, { token, resolve, reject, timeout, createdAt: now() });
  });

  enqueueEvent(session, {
    type: 'completion_request',
    data: {
      requestId,
      prompt,
      temperature: req.body?.temperature ?? 0.7,
      maxTokens: req.body?.max_tokens ?? req.body?.maxTokens ?? 512
    }
  });

  try {
    const result = await resultPromise;
    const text = result?.text || '';
    const usage = result?.usage || {
      prompt_tokens: Math.max(1, Math.round(prompt.length / 4)),
      completion_tokens: Math.max(1, Math.round(text.length / 4)),
      total_tokens: 0
    };
    if (!usage.total_tokens) usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;

    res.json({
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(now() / 1000),
      model: session.clientMeta?.model || 'browser-model',
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: text },
          finish_reason: 'stop'
        }
      ],
      usage,
      latency: result?.latency ?? null
    });
  } catch (error) {
    res.status(504).json({ error: error.message || 'error remoto' });
  }
});

setInterval(() => {
  const cutoff = now() - 1000 * 60 * 30;
  for (const [token, session] of sessions.entries()) {
    if (session.lastSeenAt < cutoff && !session.eventStream) {
      sessions.delete(token);
    }
  }
}, 1000 * 60 * 5);

app.listen(port, () => {
  console.log(`PocketModel bridge escuchando en http://localhost:${port}`);
});
