# Multi-stage Dockerfile for Backend API & App Hosting
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build Vite frontend and esbuild server backend
RUN npm run build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy dependencies and build outputs
COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

# Expose server port
EXPOSE 3000

# Start production server
CMD ["node", "dist/server.cjs"]
