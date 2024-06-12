# Utiliza una versión específica de node:20.0-alpine para evitar problemas de compatibilidad
FROM node:20.0-alpine

# Define variables de entorno
ENV PORT=3000 \
    NODE_ENV=production \
    REDIS_PASSWORD=not_set \
    DEBUG=*

# Crea el directorio de la aplicación y asigna los permisos adecuados
RUN mkdir -p /usr/app && chown node:node /usr/app
WORKDIR /usr/app

# Copia los archivos package.json y package-lock.json
COPY --chown=node:node package*.json ./

# Instala las dependencias en modo de producción
RUN npm ci --only=production

# Copia el resto del código de la aplicación
COPY --chown=node:node . .

# Expone el puerto de la aplicación
EXPOSE $PORT

# Cambia al usuario node
USER node

# Define la señal de parada para el contenedor
STOPSIGNAL SIGTERM

# Define el comando por defecto para ejecutar la aplicación
CMD ["npm", "start"]
