import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "com.yokonex.bomberman",
    appName: "Bomberman",
    webDir: "dist",
    server: {
        cleartext: true,
        // 当前测试服使用 HTTP/WS，Android 本地页面也使用 HTTP，避免 WebView 拦截混合内容请求。
        androidScheme: "http",
    },
};

export default config;
