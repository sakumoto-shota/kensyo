import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { logger } from "./logger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // NestJS の enableShutdownHooks で SIGTERM / SIGINT を捕捉
  app.enableShutdownHooks();

  const port = process.env.PORT || 8080;
  await app.listen(port);
  logger.info("Server started", { port: Number(port), pid: process.pid });
}

bootstrap();
