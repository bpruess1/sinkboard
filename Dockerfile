FROM public.ecr.aws/docker/library/node:22-slim
WORKDIR /app
COPY . .
RUN npm ci --production
EXPOSE 3000
CMD ["node", "index.js"]
