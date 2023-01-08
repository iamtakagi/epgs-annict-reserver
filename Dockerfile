FROM node:18-alpine as base

ENV NODE_ENV production

WORKDIR /app/epgs-annict-reserver

COPY .yarn .yarn
COPY .yarnrc.yml package.json yarn.lock ./
RUN yarn install --immutable
COPY tsconfig.json ./
COPY src ./src

FROM base as builder

RUN yarn tsc

FROM base

RUN apk --no-cache add tini

ENTRYPOINT ["/sbin/tini", "--"]

COPY --from=builder /app/epgs-annict-reserver/dist ./dist

CMD ["yarn", "node", "/app/epgs-annict-reserver/dist"]
