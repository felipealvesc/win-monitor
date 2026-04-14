FROM node:22-alpine AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi

COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && if [ -f pnpm-lock.yaml ]; then pnpm install --prod --frozen-lockfile; else pnpm install --prod; fi

COPY --from=build /app/dist ./dist
COPY --from=build /app/server/data ./server/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "dist/index.js"]
