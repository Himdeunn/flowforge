# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and compile TypeScript
COPY . .
RUN npx nest build

# ─── Stage 2: Runner ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only production node_modules
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy prisma schema for runtime client
COPY prisma ./prisma

# Generate Prisma client in production image
RUN npx prisma generate

EXPOSE 3000

CMD ["node", "dist/main"]
