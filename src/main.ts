import "reflect-metadata";
import { Logger, ValidationPipe, BadRequestException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import compression from "compression";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

const localCorsOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:4173",
  "http://127.0.0.1:4173"
];

const localHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const devOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/;
const corsAllowedHeaders = "Content-Type, Authorization, X-Requested-With";
const corsAllowedMethods = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";

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

function parseCsvEnv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeCorsOrigin(origin: string) {
  let parsed: URL;

  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(`Invalid CORS_ORIGIN entry: ${origin}`);
  }

  return parsed.origin;
}

function tryNormalizeRequestOrigin(origin: string) {
  try {
    return normalizeCorsOrigin(origin);
  } catch {
    return origin;
  }
}

function assertPublicOrigin(origin: string) {
  const parsed = new URL(origin);

  if (localHostnames.has(parsed.hostname)) {
    throw new Error(`Local CORS_ORIGIN is not allowed in production: ${origin}`);
  }
}

function assertPublicDatabaseUrl(databaseUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid URL in production");
  }

  if (localHostnames.has(parsed.hostname)) {
    throw new Error("DATABASE_URL must not point to a local host in production");
  }
}

function assertProductionConfig() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET?.trim();
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET?.trim();
  const unsafeSecrets = ["change-me-access-secret", "change-me-refresh-secret", "dev-access-secret", "dev-refresh-secret", undefined, ""];
  if (unsafeSecrets.includes(jwtAccessSecret) || unsafeSecrets.includes(jwtRefreshSecret)) {
    throw new Error("Unsafe JWT secrets are not allowed in production");
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required in production");
  }
  assertPublicDatabaseUrl(databaseUrl);

  const corsOrigins = parseCsvEnv(process.env.CORS_ORIGIN).map(normalizeCorsOrigin);
  if (corsOrigins.length === 0) {
    throw new Error("CORS_ORIGIN is required in production");
  }
  corsOrigins.forEach(assertPublicOrigin);
}

async function bootstrap() {
  assertProductionConfig();
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

  const configuredCorsOrigins = parseCsvEnv(process.env.CORS_ORIGIN).map(normalizeCorsOrigin);
  const corsOrigins = configuredCorsOrigins.length > 0 || process.env.NODE_ENV === "production" ? configuredCorsOrigins : localCorsOrigins;

  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestOrigin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
    const normalizedRequestOrigin = requestOrigin ? tryNormalizeRequestOrigin(requestOrigin) : undefined;

    logger.log(`CORS request origin: ${requestOrigin ?? "no-origin"}`);
    logger.log(`CORS allowed origins: ${corsOrigins.join(", ")}`);

    if (!requestOrigin) {
      if (req.method === "OPTIONS") {
        res.status(204).setHeader("Content-Length", "0").end();
        return;
      }

      next();
      return;
    }

    const isAllowedOrigin = normalizedRequestOrigin ? corsOrigins.includes(normalizedRequestOrigin) : false;
    const isAllowedDevOrigin = process.env.NODE_ENV !== "production" && devOriginPattern.test(requestOrigin);

    if (isAllowedOrigin || isAllowedDevOrigin) {
      res.setHeader("Access-Control-Allow-Origin", normalizedRequestOrigin ?? requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", corsAllowedHeaders);
      res.setHeader("Access-Control-Allow-Methods", corsAllowedMethods);
      res.setHeader("Vary", "Origin");

      if (req.method === "OPTIONS") {
        res.status(204).setHeader("Content-Length", "0").end();
        return;
      }

      next();
      return;
    }

    logger.warn(`CORS blocked origin: ${requestOrigin}`);
    if (req.method === "OPTIONS") {
      res.status(204).setHeader("Content-Length", "0").end();
      return;
    }

    next();
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
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  await app.listen(port, "0.0.0.0");
  logger.log(`Rastroom API running on http://0.0.0.0:${port}`);
  logger.log(`Swagger available on http://0.0.0.0:${port}/docs`);
}

void bootstrap();
