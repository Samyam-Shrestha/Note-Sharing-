# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
# Security: remove default content and serve only built static assets.
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# Security: run nginx worker as non-root by dropping privileges.
USER nginx
CMD ["nginx", "-g", "daemon off;"]
