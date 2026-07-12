import nodemailer from "nodemailer";

import { AuthError } from "./authError.js";

export type EmailCodePurpose = "register" | "login";

export async function sendVerificationEmail(email: string, code: string, purpose: EmailCodePurpose) {
  const host = String(process.env.SMTP_HOST ?? "").trim();
  const from = String(process.env.SMTP_FROM ?? "").trim();
  if (!host || !from) {
    throw new AuthError(503, "SMTP 未配置");
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = String(process.env.SMTP_USER ?? "").trim();
  const pass = String(process.env.SMTP_PASS ?? "");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: user ? { user, pass } : undefined,
  });
  const action = purpose === "register" ? "注册账号" : "登录账号";

  await transporter.sendMail({
    from,
    to: email,
    subject: `Bomberman ${action}验证码`,
    text: `你的验证码是：${code}\n\n验证码 10 分钟内有效，请勿转发给他人。`,
  });
}
