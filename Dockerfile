FROM oven/bun

WORKDIR /app

COPY package.json .
COPY bun.lockb .

RUN bun install --production --smol

COPY src src
COPY scripts scripts
COPY tsconfig.json .
# COPY public public

ENV RUNNING_IN_DOCKER=true
ENV NODE_ENV=production
CMD ["bun", "start"]

EXPOSE 8000