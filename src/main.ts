import "reflect-metadata";
import { Logger, ValidationPipe, BadRequestException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import compression from "compression";
import express from "express";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

function validationExceptionFactory(errors: any[]) {
  const formatted = errors.flatMap((error) => {
    const constraints = error.constraints ?? {};
    return Object.values(constraints).map((message) => ({
      field: error.property,
      message
    }));
  });

  return new BadRequestException({
    statusCode: 400,
    message: "Validation failed",
    errors: formatted
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");
  const uploadDir = process.env.UPLOAD_DIR ?? "uploads";
  const uploadPath = join(process.cwd(), uploadDir);

  mkdirSync(uploadPath, { recursive: true });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
  app.use(compression());
  app.use("/uploads", express.static(uploadPath));

  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:8080,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Rastroom API")
    .setDescription("API de rastreabilidade de pedidos, moveis, pecas e processos.")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: { persistAuthorization: true }
  });

  const port = Number(process.env.PORT ?? 8081);
  await app.listen(port);
  logger.log(`Rastroom API running on http://localhost:${port}`);
  logger.log(`Swagger available on http://localhost:${port}/docs`);
}

void bootstrap();
