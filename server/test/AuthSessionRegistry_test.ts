import assert from "assert";
import type { Client } from "colyseus";

import {
  disconnectReplacedSessions,
  disconnectSession,
  registerAuthClient,
  unregisterAuthClient,
} from "../src/authSessionRegistry.js";

type FakeClient = Client & { leaves: Array<{ code?: number; reason?: string }> };

function fakeClient(): FakeClient {
  const client = {
    leaves: [] as Array<{ code?: number; reason?: string }>,
    leave(code?: number, reason?: string) {
      this.leaves.push({ code, reason });
    },
  };
  return client as FakeClient;
}

describe("auth session registry", () => {
  it("新登录只断开旧会话", () => {
    const oldClient = fakeClient();
    const currentClient = fakeClient();
    registerAuthClient("user-1", "old-session", oldClient);
    registerAuthClient("user-1", "new-session", currentClient);

    disconnectReplacedSessions("user-1", "new-session");

    assert.deepStrictEqual(oldClient.leaves, [{ code: 4001, reason: "账号已在其他设备登录" }]);
    assert.deepStrictEqual(currentClient.leaves, []);
    unregisterAuthClient("user-1", currentClient);
  });

  it("退出旧会话不会断开新会话", () => {
    const currentClient = fakeClient();
    registerAuthClient("user-2", "new-session", currentClient);

    disconnectSession("user-2", "old-session");

    assert.deepStrictEqual(currentClient.leaves, []);
    unregisterAuthClient("user-2", currentClient);
  });
});
