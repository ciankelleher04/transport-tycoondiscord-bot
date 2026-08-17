FROM node:22-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN chmod +x /app/run.sh

CMD ["/app/run.sh"]