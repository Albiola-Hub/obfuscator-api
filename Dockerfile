FROM node:18-alpine

# Install dependencies
RUN apk add --no-cache luajit git

WORKDIR /app

# Install Node deps
COPY package.json ./
RUN npm install

# Clone Prometheus directly into correct path
RUN git clone https://github.com/prometheus-lua/Prometheus.git /app/Prometheus

# Copy app source
COPY . .

# Security / performance (optional but good)
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server.js"]
