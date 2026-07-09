import { Capacitor } from "@capacitor/core";

// 本地开发默认连接固定后端端口，避免前端端口变化时连错服务。
const LOCAL_BACKEND_PORT = "45170";
const ANDROID_EMULATOR_BACKEND_HOST = "10.0.2.2";
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
const isNativeApp = Capacitor.isNativePlatform();

function defaultBackendWsUrl() {
    // Android 模拟器里的 localhost 指向模拟器自身，需要走 10.0.2.2 才能访问电脑上的后端。
    if (isNativeApp) {
        return `ws://${ANDROID_EMULATOR_BACKEND_HOST}:${LOCAL_BACKEND_PORT}`;
    }

    if (isLocalHost) {
        return `ws://${window.location.hostname}:${LOCAL_BACKEND_PORT}`;
    }

    return `${window.location.protocol.replace("http", "ws")}//${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}`;
}

export const BACKEND_URL = import.meta.env.VITE_BACKEND_WS_URL || defaultBackendWsUrl();

export const BACKEND_HTTP_URL = import.meta.env.VITE_BACKEND_HTTP_URL || BACKEND_URL.replace(/^ws/, "http");
