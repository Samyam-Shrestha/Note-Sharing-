# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src ./src
COPY tests ./tests
RUN npm test

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime
WORKDIR /app
# Security: copy only production dependencies and runtime source.
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
ENV NODE_ENV=production
EXPOSE 4000
USER nonroot:nonroot
CMD ["src/index.js"]
