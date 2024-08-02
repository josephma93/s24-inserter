FROM node:20-alpine

ENV NODE_ENV=production
ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PATH=$PATH:/home/node/.npm-global/bin
ENV NPM_CONFIG_LOGLEVEL debug

WORKDIR /usr/src/app

RUN apk add --no-cache tini

COPY package*.json ./

RUN npm install --production

COPY . .

RUN addgroup -S nodegroup && adduser -S nodeuser -G nodegroup \
  && chown -R nodeuser:nodegroup /usr/src/app

USER nodeuser

CMD ["tini", "--", "node", "app.js"]
