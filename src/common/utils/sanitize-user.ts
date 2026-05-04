import { User } from "@prisma/client";

type SafeUser = Omit<
  User,
  "password_hash" | "refresh_token_hash" | "reset_token_hash" | "reset_token_expires_at"
>;

export function sanitizeUser(user: User): SafeUser {
  const {
    password_hash,
    refresh_token_hash,
    reset_token_hash,
    reset_token_expires_at,
    ...safe
  } = user;
  void password_hash;
  void refresh_token_hash;
  void reset_token_hash;
  void reset_token_expires_at;

  return safe;
}
