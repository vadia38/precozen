# Imagem final: nginx servindo o site estático gerado.
# Build:  docker build -f deploy/Dockerfile -t catalogo-luretec .
# Run:    docker run --rm -p 8080:80 catalogo-luretec
FROM node:22-alpine AS build
WORKDIR /app
COPY . .
ARG BASE_PATH=/
ARG SITE_URL=https://catalogo.awucloud.com.br
RUN npm run validar && npm test && BASE_PATH=$BASE_PATH SITE_URL=$SITE_URL node src/build.js

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/robots.txt >/dev/null || exit 1
