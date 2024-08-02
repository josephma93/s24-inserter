FROM node:20-alpine

ENV NODE_ENV=production

# Install tini
RUN apk add --no-cache tini

# Create app directory
RUN mkdir -p /usr/app
WORKDIR /usr/app

COPY package*.json ./

RUN npm ci --only=production

# Copy the rest of the application code as node user
COPY --chown=node:node . .

# Set the signal for the Docker to send to the container to terminate it
STOPSIGNAL SIGTERM

# Use tini to handle init system
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "app.js"]
