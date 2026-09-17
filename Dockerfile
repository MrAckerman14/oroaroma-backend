FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate && npx tsc -p tsconfig.json

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/uploads
EXPOSE 3000
CMD ["npm", "start"]
