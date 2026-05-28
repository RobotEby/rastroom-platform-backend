import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type RequestUser = {
  id: string;
  email: string;
  full_name?: string | null;
  roles: string[];
  organization_id?: string | null;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  }
);
