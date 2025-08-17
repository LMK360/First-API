#Use Node.js with Corepack (for pnpm)
FROM node:20

#Enable Corepack and set working directory
RUN corepack enable
WORKDIR /app

#Copy dependency files and install
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@10.13.1 --activate
RUN pnpm install --frozen-lockfile

#Copy the rest of your code
COPY . .

#Expose API port
EXPOSE 3000

#Start the server
CMD ["pnpm", "start"]
