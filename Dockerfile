FROM node:18-alpine

# Gagamit tayo ng luajit para mas tugma sa Prometheus engine
RUN apk add --no-cache luajit git

WORKDIR /app

COPY package.json ./
RUN npm install

# I-clone ang Prometheus
RUN git clone https://github.com/prometheus-lua/Prometheus.git

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
