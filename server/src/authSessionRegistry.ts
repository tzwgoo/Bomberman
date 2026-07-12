import type { Client } from "colyseus";

const SESSION_REPLACED_CODE = 4001;
const activeClients = new Map<string, Map<Client, string>>();

export function registerAuthClient(userId: string, sessionId: string, client: Client) {
  const clients = activeClients.get(userId) ?? new Map<Client, string>();
  clients.set(client, sessionId);
  activeClients.set(userId, clients);
}

export function unregisterAuthClient(userId: string, client: Client) {
  const clients = activeClients.get(userId);
  clients?.delete(client);
  if (clients?.size === 0) {
    activeClients.delete(userId);
  }
}

export function disconnectReplacedSessions(userId: string, currentSessionId: string) {
  const clients = activeClients.get(userId);
  if (!clients) {
    return;
  }

  // 新登录成功后，立即断开该账号在当前服务实例上的旧游戏连接。
  for (const [client, sessionId] of clients) {
    if (sessionId !== currentSessionId) {
      client.leave(SESSION_REPLACED_CODE, "账号已在其他设备登录");
      clients.delete(client);
    }
  }

  if (clients.size === 0) {
    activeClients.delete(userId);
  }
}

export function disconnectSession(userId: string, sessionId: string) {
  const clients = activeClients.get(userId);
  if (!clients) {
    return;
  }

  for (const [client, clientSessionId] of clients) {
    if (clientSessionId === sessionId) {
      client.leave(1000, "logout");
      clients.delete(client);
    }
  }

  if (clients.size === 0) {
    activeClients.delete(userId);
  }
}
