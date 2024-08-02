FROM node:20-alpine

# Define environment variables
ENV DEBUG=*
ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=debug
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin
ENV PORT=3000
ENV REDIS_PASSWORD=not_set

# Install tini
RUN apk add --no-cache tini

# Create app directory and set ownership
RUN mkdir -p /usr/app && chown node:node /usr/app
WORKDIR /usr/app

# Switch to node user
USER node

# Copy package.json and package-lock.json
COPY --chown=node:node package*.json ./

# Check if package.json and package-lock.json are copied correctly
RUN ls -la

# Install production dependencies
RUN npm ci --only=production

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
