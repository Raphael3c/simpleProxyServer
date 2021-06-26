FROM node:16-alpine

WORKDIR /usr/src/trabalho

COPY . .

EXPOSE 8888

CMD ["node", "./Trabalho.js", "30"]