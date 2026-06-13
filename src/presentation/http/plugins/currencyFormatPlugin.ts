import type { FastifyInstance } from 'fastify';
import { addFormattedCurrencyFields } from '../../../shared/utils/currencyFormatter.js';

export function registerCurrencyFormatHook(app: FastifyInstance) {
  app.addHook('onSend', async (_request, reply, payload) => {
    const contentType = reply.getHeader('content-type');
    if (!String(contentType ?? '').includes('application/json')) return payload;
    if (typeof payload !== 'string' && !Buffer.isBuffer(payload)) return payload;

    const text = Buffer.isBuffer(payload) ? payload.toString('utf8') : payload;
    if (!text) return payload;

    try {
      const parsed = JSON.parse(text) as unknown;
      const formatted = addFormattedCurrencyFields(parsed);
      return JSON.stringify(formatted);
    } catch {
      return payload;
    }
  });
}
