import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { AuthError } from "./authError.js";
import { isDatabaseConfigured, jwtSecret, prisma } from "./db.js";
import { sendVerificationEmail, type EmailCodePurpose } from "./emailService.js";

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_INTERVAL_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

export async function requestEmailCode(input: { email?: string; purpose?: string }) {
  ensureDatabaseReady();
  const email = normalizeEmail(input.email);
  const purpose = normalizePurpose(input.purpose);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (purpose === "register" && user) {
    throw new AuthError(409, "该邮箱已注册");
  }
  if (purpose === "login" && !user) {
    throw new AuthError(404, "该邮箱未绑定账号");
  }

  const recent = await prisma.emailVerificationCode.findFirst({
    where: { email, purpose, createdAt: { gt: new Date(Date.now() - RESEND_INTERVAL_MS) } },
    select: { id: true },
  });
  if (recent) {
    throw new AuthError(429, "验证码发送过于频繁，请稍后再试");
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const record = await prisma.emailVerificationCode.create({
    data: {
      email,
      purpose,
      codeHash: hashCode(email, purpose, code),
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  try {
    await sendVerificationEmail(email, code, purpose);
  } catch (error) {
    // 邮件未发出时删除记录，让用户修复配置后可以立即重试。
    await prisma.emailVerificationCode.delete({ where: { id: record.id } });
    throw error;
  }
}

export async function verifyEmailCode(emailInput: string | undefined, codeInput: string | undefined, purpose: EmailCodePurpose) {
  ensureDatabaseReady();
  const email = normalizeEmail(emailInput);
  const code = String(codeInput ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    throw new AuthError(400, "请输入 6 位邮箱验证码");
  }

  const record = await prisma.emailVerificationCode.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.expiresAt.getTime() <= Date.now()) {
    throw new AuthError(400, "验证码已失效，请重新获取");
  }

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashCode(email, purpose, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    const attempts = record.attempts + 1;
    await prisma.emailVerificationCode.update({
      where: { id: record.id },
      data: { attempts, consumedAt: attempts >= MAX_ATTEMPTS ? new Date() : undefined },
    });
    throw new AuthError(400, attempts >= MAX_ATTEMPTS ? "验证码错误次数过多，请重新获取" : "邮箱验证码错误");
  }

  const consumed = await prisma.emailVerificationCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) {
    throw new AuthError(400, "验证码已使用，请重新获取");
  }
  return email;
}

export function normalizeEmail(email?: string) {
  const value = String(email ?? "").trim().toLowerCase();
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new AuthError(400, "邮箱格式不正确");
  }
  return value;
}

function normalizePurpose(purpose?: string): EmailCodePurpose {
  if (purpose === "register" || purpose === "login") {
    return purpose;
  }
  throw new AuthError(400, "验证码用途不正确");
}

function hashCode(email: string, purpose: EmailCodePurpose, code: string) {
  const secret = process.env.EMAIL_CODE_SECRET || jwtSecret();
  return createHmac("sha256", secret).update(`${email}:${purpose}:${code}`).digest("hex");
}

function ensureDatabaseReady() {
  if (!isDatabaseConfigured()) {
    throw new AuthError(503, "数据库未配置");
  }
}
