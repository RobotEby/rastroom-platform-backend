import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";

type ErrorBody = {
  statusCode: number;
  message: string;
  errors?: Array<{ field?: string; message: string }>;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const body = this.toBody(exception);

    response.status(body.statusCode).json({
      statusCode: body.statusCode,
      message: body.message,
      ...(body.errors?.length ? { errors: body.errors } : {})
    });
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === "object" && response !== null) {
        const payload = response as Partial<ErrorBody> & { message?: string | string[] };
        return {
          statusCode,
          message: Array.isArray(payload.message)
            ? payload.message.join("; ")
            : payload.message ?? exception.message,
          errors: payload.errors
        };
      }
      return { statusCode, message: String(response) };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        return {
          statusCode: HttpStatus.CONFLICT,
          message: "Conflict",
          errors: [
            {
              field: Array.isArray(exception.meta?.target)
                ? exception.meta?.target.join(",")
                : "resource",
              message: "Value already exists"
            }
          ]
        };
      }

      if (exception.code === "P2025") {
        return { statusCode: HttpStatus.NOT_FOUND, message: "Resource not found" };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error"
    };
  }
}
