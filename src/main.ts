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

function assertProductionSecrets() {
  if (process.env.NODE_ENV === "production") {
    const unsafe = ["change-me-access-secret", "change-me-refresh-secret", "dev-access-secret", "dev-refresh-secret", undefined, ""];
    if (unsafe.includes(process.env.JWT_ACCESS_SECRET) || unsafe.includes(process.env.JWT_REFRESH_SECRET)) {
      throw new Error("Unsafe JWT secrets are not allowed in production");
    }
  }
}

async function bootstrap() {
  assertProductionSecrets();
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

  const defaultCorsOrigins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:4173",
    "http://127.0.0.1:4173"
  ];

  const corsOrigins = (process.env.CORS_ORIGIN ?? defaultCorsOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/;

  app.enableCors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const isAllowedOrigin = corsOrigins.includes(origin);
    const isAllowedDevOrigin = process.env.NODE_ENV !== "production" && devOriginPattern.test(origin);

    if (isAllowedOrigin || isAllowedDevOrigin) {
      callback(null, true);
      return;
    }

    logger.warn(`CORS blocked origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 204
});

  logger.log(`CORS enabled for: ${corsOrigins.join(", ")}`);

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
