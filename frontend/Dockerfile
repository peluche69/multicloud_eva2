FROM node:20-alpine
RUN apk add --no-cache postgresql-client dcron
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN echo "0 3 * * * cd /app && node backup.js >> /var/log/backup.log 2>&1" > /etc/crontabs/root
EXPOSE 80
CMD crond && node index.js