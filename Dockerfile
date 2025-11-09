FROM node:18-bullseye

WORKDIR /usr/src/app

# Copy package files first for caching
COPY package*.json ./

# Install all deps (including dev) so we can run the TypeScript build and prisma generate
# Use npm install with legacy-peer-deps to avoid failing on missing package-lock or strict peer deps
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy source
COPY . .

# Build TypeScript to /dist
# Run the project's build script (tsc && tsc-alias). As a fallback, run npx tsc-alias explicitly
# so that emitted JS imports have path aliases rewritten for Node ESM resolution.
RUN npm run build || true
RUN npx tsc-alias --project tsconfig.json --resolve-full-paths --resolve-full-extension .js || true

# Generate Prisma client (schema must be present after COPY . .)
RUN npx prisma generate || true

# Make entrypoint executable
RUN chmod +x ./docker/entrypoint.sh || true

# Remove dev dependencies to keep final image smaller
RUN npm prune --production || true

EXPOSE 3000

# Entrypoint runs migrations (if DB available) then execs the CMD
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "dist/main.js"]
