interface BackendErrorPayload {
  message?: string | string[];
  error?: string;
  statusCode?: number;
}

function asText(input: unknown): string {
  if (Array.isArray(input)) {
    return input.map((x) => String(x)).join('. ');
  }

  if (typeof input === 'string') {
    return input;
  }

  return '';
}

export function parseBackendErrorMessage(raw: string): string {
  const text = (raw ?? '').trim();
  if (!text) {
    return '';
  }

  try {
    const payload = JSON.parse(text) as BackendErrorPayload;
    const fromMessage = asText(payload.message).trim();
    if (fromMessage) {
      return fromMessage;
    }

    const fromError = asText(payload.error).trim();
    if (fromError) {
      return fromError;
    }
  } catch {
    // Keep original text when payload is not JSON.
  }

  return text;
}

export function toFriendlyErrorMessage(input: string, fallback = 'Ocurrió un error. Inténtalo de nuevo.'): string {
  const message = (input ?? '').trim().toLowerCase();
  if (!message) {
    return fallback;
  }

  if (/failed to fetch|fetch failed|networkerror|network error|timeout|econnrefused|socket hang up/.test(message)) {
    return 'No se pudo conectar con el servidor. Verifica tu conexión e inténtalo de nuevo.';
  }

  if (/jwt expired|token expired|invalid token|missing bearer|unauthorized|forbidden/.test(message)) {
    return 'Tu sesión venció. Inicia sesión nuevamente.';
  }

  if (/invalid credentials|credenciales|invalid email or password/.test(message)) {
    return 'Correo o contraseña incorrectos.';
  }

  if (/email already registered|email already exists|duplicate key value/.test(message)) {
    return 'Ese correo ya está registrado.';
  }

  if (/invalid sponsor code|sponsor code/.test(message)) {
    return 'El código de referido/patrocinador no es válido.';
  }

  if (/order still has pending payment/.test(message)) {
    return 'La orden aún tiene un pago pendiente.';
  }

  if (/product .* not found|product not found/.test(message)) {
    return 'Uno de los productos ya no está disponible.';
  }

  if (/not enough stock/.test(message)) {
    return 'No hay suficiente stock para completar la compra.';
  }

  if (/minimum withdrawal is/.test(message)) {
    return 'El monto está por debajo del mínimo de retiro configurado por administración.';
  }

  if (/insufficient wallet balance|wallet does not have enough balance/.test(message)) {
    return 'No tienes saldo suficiente en tu billetera para este retiro.';
  }

  if (/request entity too large|payload too large|entity too large|413/.test(message)) {
    return 'El comprobante es demasiado pesado. Usa una foto con menor resolución o intenta con otra imagen.';
  }

  if (/comprobante es demasiado pesado|comprobante debe ser una imagen/.test(message)) {
    return input;
  }

  if (message.startsWith('{') && message.endsWith('}')) {
    return fallback;
  }

  return input;
}

export function normalizeError(error: unknown, fallback = 'Ocurrió un error. Inténtalo de nuevo.'): string {
  if (error instanceof Error) {
    return toFriendlyErrorMessage(parseBackendErrorMessage(error.message), fallback);
  }

  if (typeof error === 'string') {
    return toFriendlyErrorMessage(parseBackendErrorMessage(error), fallback);
  }

  return fallback;
}
