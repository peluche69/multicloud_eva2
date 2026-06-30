FROM postgres:15

ENV POSTGRES_DB=simi_erp
ENV POSTGRES_USER=simi_user
ENV POSTGRES_PASSWORD=simi_pass123

COPY init.sql /docker-entrypoint-initdb.d/init.sql

EXPOSE 5432 