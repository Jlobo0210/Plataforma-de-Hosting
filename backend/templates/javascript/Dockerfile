FROM node:18-slim

WORKDIR /app

# Express es el framework HTTP de Node
RUN npm install express acorn

COPY runner.js .

CMD ["node", "runner.js"]
