import jwt from "jsonwebtoken";
import type { UserRole } from "@/models/User";

import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

export type JwtPayload = {
  sub: string;
  // Duplicate of `sub` for DRD clarity (explicit user id in payload).
  uid: string;
  email: string;
  role: UserRole;
  assignedDevices: string[];
  iat?: number;
  exp?: number;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment (.env.local)");
  }
  return secret;
}

export function signAuthToken(payload: Omit<JwtPayload, "iat" | "exp">) {
  return jwt.sign(payload, getJwtSecret(), {
    algorithm: "HS256",
    expiresIn: "7d",
  });
}

export function verifyAuthToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
  }) as JwtPayload;
}
