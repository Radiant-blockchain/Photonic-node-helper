FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-fund --no-audit

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# curl is needed for Docker socket communication
RUN apk add --no-cache curl
COPY --from=build /app/dist /app/dist
COPY --from=deps /app/node_modules /app/node_modules
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
