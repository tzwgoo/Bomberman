import type { Prisma } from "@prisma/client";

import { isDatabaseConfigured, prisma } from "./db";
import { tierForScore } from "./matchStatsService";

export type MatchResultPlayer = {
  sessionId: string;
  userId: string;
  nickname: string;
  score: number;
  alive: boolean;
};

export type MatchResultInput = {
  roomId: string;
  mapKey: string;
  startedAt: Date;
  endedAt: Date;
  winnerUserId?: string;
  players: MatchResultPlayer[];
  rawData: Record<string, unknown>;
};

export type RatingChangeResult = {
  userId: string;
  beforeScore: number;
  delta: number;
  afterScore: number;
  tier: string;
  rank: number;
};

export async function saveMatchResult(input: MatchResultInput) {
  if (!isDatabaseConfigured()) {
    return { skipped: true, reason: "database_not_configured" };
  }

  const players = input.players.filter((player) => player.userId);
  if (!players.length) {
    return { skipped: true, reason: "no_registered_players" };
  }

  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);

  // 比赛只在最终结算后落库一次，避免对局中频繁写库影响实时同步。
  const result = await prisma.$transaction(async (tx) => {
    const knownWinnerUserId = rankedPlayers.some((player) => player.userId === input.winnerUserId) ? input.winnerUserId : null;
    const match = await tx.match.create({
      data: {
        roomId: input.roomId,
        mapKey: input.mapKey,
        status: "settled",
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        winnerUserId: knownWinnerUserId || null,
        rawData: input.rawData as Prisma.InputJsonValue,
      },
    });
    const users = await tx.user.findMany({
      where: { id: { in: rankedPlayers.map((player) => player.userId) } },
      select: { id: true, currentScore: true },
    });
    const scoreByUser = new Map(users.map((user) => [user.id, user.currentScore]));
    const ratingChanges: RatingChangeResult[] = [];
    const survivedSeconds = Math.max(0, Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 1000));

    for (const [index, player] of rankedPlayers.entries()) {
      const rank = index + 1;
      const beforeScore = scoreByUser.get(player.userId) ?? 1000;
      const delta = ratingDelta({
        currentScore: beforeScore,
        playerCount: rankedPlayers.length,
        rank,
        isWinner: player.userId === knownWinnerUserId,
        isDraw: !knownWinnerUserId,
      });
      const afterScore = Math.max(0, beforeScore + delta);

      await tx.matchPlayer.create({
        data: {
          matchId: match.id,
          userId: player.userId,
          nickname: player.nickname,
          rank,
          score: player.score,
          deaths: player.alive ? 0 : 1,
          survivedSeconds,
        },
      });
      await tx.user.update({
        where: { id: player.userId },
        data: { currentScore: afterScore },
      });
      await tx.ratingChange.create({
        data: {
          matchId: match.id,
          userId: player.userId,
          beforeScore,
          delta,
          afterScore,
          reason: knownWinnerUserId ? "match_settled" : "match_draw",
          rank,
          season: "default",
        },
      });

      ratingChanges.push({
        userId: player.userId,
        beforeScore,
        delta,
        afterScore,
        tier: tierForScore(afterScore),
        rank,
      });
    }

    return { matchId: match.id, ratingChanges };
  });

  return { skipped: false, ...result };
}

type RatingDeltaInput = {
  currentScore: number;
  playerCount: number;
  rank: number;
  isWinner: boolean;
  isDraw: boolean;
};

type RatingTierRule = {
  minScore: number;
  win: number;
  loss: number;
  second: number;
  third: number;
  fourth: number;
};

const RATING_TIER_RULES: RatingTierRule[] = [
  { minScore: 1800, win: 12, loss: -18, second: 4, third: -10, fourth: -18 },
  { minScore: 1500, win: 16, loss: -14, second: 6, third: -8, fourth: -14 },
  { minScore: 1200, win: 20, loss: -10, second: 8, third: -5, fourth: -10 },
  { minScore: 1000, win: 22, loss: -8, second: 10, third: -4, fourth: -8 },
  { minScore: 0, win: 26, loss: -6, second: 12, third: -3, fourth: -6 },
];

export function ratingDelta(input: RatingDeltaInput) {
  if (input.isDraw) {
    return 0;
  }

  const rule = ratingRuleForScore(input.currentScore);

  if (input.playerCount <= 2) {
    return input.isWinner ? rule.win : rule.loss;
  }

  if (input.rank === 1) {
    return rule.win;
  }

  if (input.rank === 2) {
    return rule.second;
  }

  if (input.rank === 3) {
    return rule.third;
  }

  return rule.fourth;
}

function ratingRuleForScore(score: number) {
  // 低段位降低失败成本、提高胜利收益；高段位反过来，控制高分膨胀。
  return RATING_TIER_RULES.find((rule) => score >= rule.minScore) ?? RATING_TIER_RULES[RATING_TIER_RULES.length - 1];
}
