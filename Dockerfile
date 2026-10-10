# BizDecide: single-container deploy for a VPS (no Firebase needed)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
# python3 runs the BizDecide skill scripts for the Claude CFO team
RUN apk add --no-cache python3
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3100 \
    BIZDECIDE_STORE=local
COPY --from=build /app ./
RUN mkdir -p /app/.data
EXPOSE 3100
CMD ["npm", "run", "start"]
