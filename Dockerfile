FROM mcr.microsoft.com/playwright:v1.45.0-jammy

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias del backend
RUN npm ci --only=production

# Instalar navegadores y dependencias de sistema de Playwright
RUN npx playwright install chromium --with-deps

# Copiar el resto del código fuente del backend
COPY . .

# Exponer el puerto asignado por Render (variable $PORT o 3000 por defecto)
ENV PORT=3000
ENV NODE_ENV=production
ENV HEADLESS=true

EXPOSE 3000

# Iniciar servidor backend
CMD ["node", "server.js"]
