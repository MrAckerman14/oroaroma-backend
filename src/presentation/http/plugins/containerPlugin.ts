import fp from 'fastify-plugin';
import { buildContainer } from '../../../application/Container.js';

export const containerPlugin = fp(async (app) => {
  app.decorate('container', buildContainer(app));
});
