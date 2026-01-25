FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-fund --no-audit

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json ./
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
ARG VITE_API_BASE=http://localhost:3001
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
