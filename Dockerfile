FROM node:18-alpine

# I-install ang Lua at Git
RUN apk add --no-cache lua5.3 lua5.3-dev git

WORKDIR /app

# Kopyahin ang package.json at mag-install
COPY package.json ./
RUN npm install

# I-clone ang Prometheus directly sa server
RUN git clone https://github.com/prometheus-lua/Prometheus.git

# Kopyahin ang server.js
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
