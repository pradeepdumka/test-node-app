FROM node:24

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

ENV HOST=0.0.0.0
ENV PORT=4000

EXPOSE 4000

CMD ["npm", "run", "start"]