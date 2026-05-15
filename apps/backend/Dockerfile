FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --production
RUN npx prisma generate

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
