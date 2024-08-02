FROM node:20-alpine

# Define environment variables
ENV DEBUG=*
ENV NODE_ENV=production
ENV PORT=3000
ENV REDIS_PASSWORD=not_set

# Install tini
RUN apk add --no-cache tini

# Create app directory and set ownership
RUN mkdir -p /usr/app && chown node:node /usr/app
WORKDIR /usr/app

# Install dependencies as node user
USER node

# Copy package.json and package-lock.json
COPY --chown=node:node package*.json ./

# Install production dependencies
RUN npm ci --only=production || { cat npm-debug.log; exit 1; }

# Copy the rest of the application code
COPY --chown=node:node . .

# Expose the application port
EXPOSE $PORT

# Set the stop signal for the container
STOPSIGNAL SIGTERM

# Use tini to handle init system
ENTRYPOINT ["tini", "--"]

# Start the application
CMD ["npm", "start"]
