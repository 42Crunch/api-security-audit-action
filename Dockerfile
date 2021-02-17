FROM node:15-alpine3.11 AS builder
COPY . /build
WORKDIR /build
RUN npm ci && npm run build && npm prune --production

FROM node:15-alpine3.11
ENV NODE_ENV=production
RUN apk add --no-cache tini

RUN mkdir /action
COPY --from=builder /build/package.json /action
COPY --from=builder /build/node_modules /action/node_modules
COPY --from=builder /build/dist /action/dist

ENTRYPOINT [ "/sbin/tini", "--", "node", "/action/dist/index.js" ]
