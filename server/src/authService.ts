import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";

import { AuthError } from "./authError.js";
import { disconnectReplacedSessions, disconnectSession } from "./authSessionRegistry.js";
import { isDatabaseConfigured, jwtSecret, prisma } from "./db.js";
import { verifyEmailCode } from "./emailVerificationService.js";

export { AuthError } from "./authError.js";

export type AuthUserDto = {
  id: string;
  username: string;
  email: string | null;
  nickname: string;
  avatar: string | null;
  color: string | null;
  roleId: string | null;
  characterKey: string | null;
  currentScore: number;
  isAdmin: boolean;
};

export type AuthRoomUser = {
  userId: string;
  username: string;
  nickname: string;
  authSessionId: string;
};

export async function registerUser(input: { username?: string; email?: string; emailCode?: string; password?: string; nickname?: string }) {
  ensureDatabaseReady();
  const username = normalizeUsername(input.username);
  const password = normalizePassword(input.password);
  const nickname = normalizeNickname(input.nickname || username);
  if (await prisma.user.findUnique({ where: { username }, select: { id: true } })) {
    throw new AuthError(409, "用户名已存在");
  }
  const email = await verifyEmailCode(input.email, input.emailCode, "register");
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        nickname,
        avatar: "🙂",
        color: "#f6c453",
        roleId: "rookie",
        characterKey: "rookie",
      },
    });

    return createAuthResponse(user);
  } catch (error) {
    if (isUniqueError(error)) {
      throw new AuthError(409, "用户名或邮箱已存在");
    }

    throw error;
  }
}

export async function loginUser(input: { username?: string; password?: string }) {
  ensureDatabaseReady();
  const username = normalizeUsername(input.username);
  const password = normalizePassword(input.password);
  const user = await prisma.user.findUnique({ where: { username } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new AuthError(401, "用户名或密码错误");
  }

  return createAuthResponse(user);
}

export async function loginUserByEmailCode(input: { email?: string; emailCode?: string }) {
  ensureDatabaseReady();
  const email = await verifyEmailCode(input.email, input.emailCode, "login");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthError(401, "该邮箱未绑定账号");
  }
  return createAuthResponse(user);
}

export async function getUserByToken(token?: string) {
  const authUser = decodeAuthToken(token);
  if (!authUser || !isDatabaseConfigured()) {
    return null;
  }

  // 一次查询同时校验用户和当前会话，避免并发登录时旧请求穿过两次查询之间的空隙。
  return prisma.user.findFirst({
    where: { id: authUser.userId, activeSessionId: authUser.authSessionId },
  });
}

export async function verifyAuthToken(token?: string): Promise<AuthRoomUser | null> {
  const authUser = decodeAuthToken(token);
  if (!authUser || !isDatabaseConfigured()) {
    return null;
  }

  // JWT 合法还不够，必须与数据库中的当前会话一致，旧令牌才会立即失效。
  const activeUser = await prisma.user.findFirst({
    where: { id: authUser.userId, activeSessionId: authUser.authSessionId },
    select: { id: true },
  });
  return activeUser ? authUser : null;
}

export async function revokeAuthToken(token?: string) {
  const authUser = decodeAuthToken(token);
  if (!authUser || !isDatabaseConfigured()) {
    return;
  }

  const result = await prisma.user.updateMany({
    where: { id: authUser.userId, activeSessionId: authUser.authSessionId },
    data: { activeSessionId: null },
  });
  if (result.count > 0) {
    disconnectSession(authUser.userId, authUser.authSessionId);
  }
}

function decodeAuthToken(token?: string): AuthRoomUser | null {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, jwtSecret());
    if (!payload || typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.sid !== "string") {
      return null;
    }

    return {
      userId: payload.sub,
      username: String(payload.username ?? ""),
      nickname: String(payload.nickname ?? ""),
      authSessionId: payload.sid,
    };
  } catch {
    return null;
  }
}

export async function updateUserProfile(userId: string, input: {
  nickname?: string;
  avatar?: string;
  color?: string;
  roleId?: string;
  characterKey?: string;
}) {
  ensureDatabaseReady();

  // 只允许客户端更新展示资料，账号名和密码不在这个接口里改。
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      nickname: normalizeNickname(input.nickname),
      avatar: trimOptional(input.avatar, 24),
      color: normalizeColor(input.color),
      roleId: trimOptional(input.roleId, 32),
      characterKey: trimOptional(input.characterKey, 32),
    },
  });

  return serializeUser(user);
}

export async function createAuthResponse(user: User) {
  const authSessionId = randomUUID();
  await prisma.user.update({
    where: { id: user.id },
    data: { activeSessionId: authSessionId },
  });
  disconnectReplacedSessions(user.id, authSessionId);

  const safeUser = serializeUser(user);
  const token = jwt.sign(
    {
      username: user.username,
      nickname: user.nickname,
      sid: authSessionId,
    },
    jwtSecret(),
    {
      subject: user.id,
      expiresIn: "7d",
    },
  );

  return { token, user: safeUser };
}

export function serializeUser(user: User): AuthUserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    nickname: user.nickname,
    avatar: user.avatar,
    color: user.color,
    roleId: user.roleId,
    characterKey: user.characterKey,
    currentScore: user.currentScore,
    isAdmin: isAdminUsername(user.username),
  };
}

export function isAdminUsername(username: string) {
  const admins = String(process.env.ADMIN_USERNAMES ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(username.trim().toLowerCase());
}

function ensureDatabaseReady() {
  if (!isDatabaseConfigured()) {
    throw new AuthError(503, "数据库未配置");
  }
}

function normalizeUsername(username?: string) {
  const value = String(username ?? "").trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(value)) {
    throw new AuthError(400, "用户名只能使用 3-24 位小写字母、数字或下划线");
  }

  return value;
}

function normalizePassword(password?: string) {
  const value = String(password ?? "");
  if (value.length < 6 || value.length > 64) {
    throw new AuthError(400, "密码长度需要 6-64 位");
  }

  return value;
}

function normalizeNickname(nickname?: string) {
  return String(nickname ?? "").trim().slice(0, 16) || "玩家";
}

function normalizeColor(color?: string) {
  const value = trimOptional(color, 16);
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : undefined;
}

function trimOptional(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim().slice(0, maxLength);
  return text || undefined;
}

function isUniqueError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
