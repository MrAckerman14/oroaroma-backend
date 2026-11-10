import type { FastifyInstance } from 'fastify';
import { idParamsSchema } from '../schemas/commonSchemas.js';
import {
  creditNoteSchema,
  fiscalDocumentListQuerySchema,
  fiscalProfileSchema,
  fiscalSequenceSchema,
  fiscalSequenceUpdateSchema,
  issueInvoiceSchema
} from '../schemas/invoicingSchemas.js';

export async function invoicingRoutes(app: FastifyInstance) {
  const invoicing = app.container.invoicing;
  const can = (action: 'read' | 'create' | 'update' | 'void') => ({
    preHandler: [app.authenticate, app.authorize('fiscal-documents', action)]
  });

  // Datos fiscales de la empresa y proveedor
  app.get('/fiscal-profile', can('read'), async (request) => ({
    data: await invoicing.getProfile(request.authUser!)
  }));

  app.put('/fiscal-profile', can('update'), async (request) => ({
    data: await invoicing.saveProfile(request.authUser!, fiscalProfileSchema.parse(request.body))
  }));

  // Rangos de e-NCF autorizados por la DGII
  app.get('/fiscal-sequences', can('read'), async (request) => ({
    data: await invoicing.listSequences(request.authUser!)
  }));

  app.post('/fiscal-sequences', can('update'), async (request, reply) => {
    const sequence = await invoicing.addSequence(request.authUser!, fiscalSequenceSchema.parse(request.body));
    return reply.status(201).send({ data: sequence });
  });

  app.patch('/fiscal-sequences/:id', can('update'), async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    const { active } = fiscalSequenceUpdateSchema.parse(request.body);
    return { data: await invoicing.setSequenceActive(request.authUser!, id, active) };
  });

  // Comprobantes
  app.get('/fiscal-documents', can('read'), async (request) => ({
    data: await invoicing.list(request.authUser!, request.branchId, fiscalDocumentListQuerySchema.parse(request.query))
  }));

  app.get('/fiscal-documents/:id', can('read'), async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    return { data: await invoicing.detail(request.authUser!, request.branchId, id) };
  });

  app.post('/sales/:id/fiscal-invoice', can('create'), async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const document = await invoicing.issueForSale(request.authUser!, request.branchId, id, issueInvoiceSchema.parse(request.body ?? {}));
    return reply.status(201).send({ data: document });
  });

  app.post('/fiscal-documents/:id/credit-note', can('void'), async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const document = await invoicing.issueCreditNote(request.authUser!, request.branchId, id, creditNoteSchema.parse(request.body));
    return reply.status(201).send({ data: document });
  });

  app.post('/fiscal-documents/:id/retry', can('create'), async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    return { data: await invoicing.retry(request.authUser!, request.branchId, id) };
  });

  app.post('/fiscal-documents/:id/refresh', can('read'), async (request) => {
    const { id } = idParamsSchema.parse(request.params);
    return { data: await invoicing.refresh(request.authUser!, request.branchId, id) };
  });
}
