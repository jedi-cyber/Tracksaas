FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY src ./src
COPY test ./test

EXPOSE 3000

CMD ["npm", "start"]
