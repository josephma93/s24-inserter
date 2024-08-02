FROM node:20-alpine

ENV NODE_ENV=production

# Install tini
RUN apk add --no-cache tini

# Create app directory and set ownership
RUN mkdir -p /usr/app && chown node:node /usr/app
WORKDIR /usr/app

# Install dependencies as node user
USER node

COPY --chown=node:node package*.json ./

RUN npm ci --only=production

# Copy the rest of the application code as node user
COPY --chown=node:node . .

# Set the signal for the Docker to send to the container to terminate it
STOPSIGNAL SIGTERM

# Use tini to handle init system
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["node", "app.js"]
