FROM ghcr.io/home-assistant/aarch64-base:latest

RUN apk add --no-cache nodejs npm

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN chmod +x /app/run.sh

CMD ["/app/run.sh"]
