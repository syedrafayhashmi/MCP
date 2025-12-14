FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./
RUN npm run build
RUN mkdir -p dist/db && cp -R src/db/migrations dist/db/

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/better-auth_migrations ./better-auth_migrations
COPY --from=builder /app/mcp ./mcp

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "run", "start"]
