FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src

RUN npm run build

EXPOSE 4000

CMD ["node", "dist/app.js"]
