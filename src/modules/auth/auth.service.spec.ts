import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const prisma = {
    organization: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    }
  };
  const jwt = {
    signAsync: jest.fn()
  };
  const config = {
    get: jest.fn()
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma as any, jwt as unknown as JwtService, config as unknown as ConfigService);
    jwt.signAsync.mockResolvedValueOnce("access-token").mockResolvedValueOnce("refresh-token");
  });

  it("registers a new workspace owner and hides sensitive fields", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.organization.findUnique.mockResolvedValue(null);
    prisma.organization.create.mockResolvedValue({
      id: "organization-id",
      name: "Novo Usuario Workspace",
      slug: "novo-rastroom-local",
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    });
    prisma.user.create.mockImplementation(async ({ data }) => ({
      id: "user-id",
      email: data.email,
      full_name: data.full_name,
      roles: data.roles,
      organization_id: data.organization_id,
      password_hash: data.password_hash,
      refresh_token_hash: null,
      reset_token_hash: null,
      reset_token_expires_at: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null
    }));
    prisma.user.update.mockResolvedValue({});

    const result = await service.register({
      email: "Novo@Rastroom.local",
      full_name: "Novo Usuario",
      password: "Rastroom@123"
    });

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "novo@rastroom.local",
          organization_id: "organization-id",
          roles: ["owner", "admin", "supervisor"]
        })
      })
    );
    expect(result.access_token).toBe("access-token");
    expect(result.refresh_token).toBe("refresh-token");
    expect(result.user).not.toHaveProperty("password_hash");
    expect(result.user).not.toHaveProperty("refresh_token_hash");
  });

  it("rejects login when password is invalid", async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: "user-id",
      email: "admin@rastroom.local",
      roles: ["admin"],
      password_hash: await argon2.hash("Rastroom@123"),
      is_active: true,
      deleted_at: null
    });

    await expect(
      service.login({ email: "admin@rastroom.local", password: "wrong-pass" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
