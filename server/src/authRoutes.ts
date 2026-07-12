import type { Application, Request, Response } from "express";

import { AuthError } from "./authError.js";
import { decryptAuthPayload } from "./authCrypto.js";
import { getUserByToken, loginUser, loginUserByEmailCode, registerUser, revokeAuthToken, serializeUser, updateUserProfile } from "./authService.js";
import { requestEmailCode } from "./emailVerificationService.js";
import { getLeaderboard, getUserStats } from "./matchStatsService.js";

type AuthedRequest = Request & {
  authUserId?: string;
};

export function registerAuthRoutes(app: Application) {
  app.post("/auth/register", asyncRoute(async (req, res) => {
    res.json(await registerUser(decryptAuthPayload(req.body ?? {})));
  }));

  app.post("/auth/login", asyncRoute(async (req, res) => {
    res.json(await loginUser(decryptAuthPayload(req.body ?? {})));
  }));

  app.post("/auth/login/email", asyncRoute(async (req, res) => {
    res.json(await loginUserByEmailCode(decryptAuthPayload(req.body ?? {})));
  }));

  app.post("/auth/email-code", asyncRoute(async (req, res) => {
    await requestEmailCode(decryptAuthPayload(req.body ?? {}));
    res.status(204).end();
  }));

  app.post("/auth/logout", asyncRoute(async (req, res) => {
    await revokeAuthToken(bearerToken(req));
    res.status(204).end();
  }));

  app.get("/me", requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
    const user = await getUserByToken(bearerToken(req));
    if (!user) {
      throw new AuthError(401, "登录已失效");
    }

    res.json({ user: serializeUser(user) });
  }));

  app.put("/me/profile", requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
    res.json({ user: await updateUserProfile(req.authUserId!, req.body ?? {}) });
  }));

  app.get("/me/stats", requireAuth, asyncRoute(async (req: AuthedRequest, res) => {
    res.json(await getUserStats(req.authUserId!));
  }));

  app.get("/leaderboard", asyncRoute(async (req, res) => {
    res.json({ entries: await getLeaderboard(Number(req.query.limit ?? 20)) });
  }));
}

async function requireAuth(req: AuthedRequest, res: Response, next: (error?: unknown) => void) {
  const user = await getUserByToken(bearerToken(req));
  if (!user) {
    res.status(401).json({ message: "请先登录" });
    return;
  }

  req.authUserId = user.id;
  next();
}

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response) => {
    handler(req, res).catch((error) => {
      if (error instanceof AuthError) {
        res.status(error.status).json({ message: error.message });
        return;
      }

      console.error("HTTP route error", error);
      res.status(500).json({ message: "服务异常" });
    });
  };
}

function bearerToken(req: Request) {
  const value = req.headers.authorization ?? "";
  return value.startsWith("Bearer ") ? value.slice("Bearer ".length) : "";
}
