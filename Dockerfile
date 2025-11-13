FROM node:18-bullseye

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .

RUN npm run build || true
RUN npx tsc-alias --project tsconfig.json --resolve-full-paths --resolve-full-extension .js || true

RUN npx prisma generate || true

RUN chmod +x ./docker/entrypoint.sh || true

RUN npm prune --production || true

EXPOSE 3000

ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["node", "dist/main.js"]
