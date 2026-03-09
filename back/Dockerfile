FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx typeorm migration:run -d dist/database/migration/datasource.js && node dist/database/seed/seed.js && node dist/main"]
