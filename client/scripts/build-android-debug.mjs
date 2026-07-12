import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const androidRoot = resolve(clientRoot, "android");
const apkPath = resolve(androidRoot, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
const javaHome = process.env.JAVA_HOME;

if (nodeMajor < 22) {
    console.error("Android 打包需要 Node.js 22 或更高版本，当前版本：" + process.version);
    process.exit(1);
}

// Gradle 优先使用 JAVA_HOME，提前校验可以避免构建到原生阶段才发现 JDK 版本错误。
const javaReleasePath = javaHome ? resolve(javaHome, "release") : "";
if (!javaReleasePath || !existsSync(javaReleasePath)) {
    console.error("请将 JAVA_HOME 设置为 JDK 17 或更高版本的安装目录。");
    process.exit(1);
}

const javaVersion = readFileSync(javaReleasePath, "utf8").match(/^JAVA_VERSION="([^"]+)"/m)?.[1] ?? "";
const javaVersionParts = javaVersion.split(".");
const javaMajor = Number.parseInt(javaVersionParts[0] === "1" ? javaVersionParts[1] : javaVersionParts[0], 10);
if (!Number.isFinite(javaMajor) || javaMajor < 17) {
    console.error(`Android 打包需要 JDK 17 或更高版本，JAVA_HOME 当前版本：${javaVersion || "未知"}`);
    process.exit(1);
}

function runStep(name, command, args, cwd = clientRoot) {
    console.log(`\n[Android] ${name}`);
    const result = spawnSync(command, args, {
        cwd,
        stdio: "inherit",
    });

    if (result.error) {
        console.error(result.error.message);
        process.exit(1);
    }
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

// 按固定顺序构建 Web、同步原生资源，再生成可直接安装的 Debug APK。
runStep("构建 Android Web 资源", process.execPath, [resolve(clientRoot, "node_modules", "vite", "bin", "vite.js"), "build", "--mode", "android"]);
runStep("同步 Capacitor Android 工程", process.execPath, [resolve(clientRoot, "node_modules", "@capacitor", "cli", "bin", "capacitor"), "sync", "android"]);
if (process.platform === "win32") {
    runStep("构建 Debug APK", process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "gradlew.bat", "assembleDebug"], androidRoot);
} else {
    runStep("构建 Debug APK", "./gradlew", ["assembleDebug"], androidRoot);
}

if (!existsSync(apkPath)) {
    console.error("Gradle 执行成功，但没有找到 Debug APK：" + apkPath);
    process.exit(1);
}

const apkSizeMb = (statSync(apkPath).size / 1024 / 1024).toFixed(2);
console.log(`\n[Android] 构建完成：${apkPath} (${apkSizeMb} MB)`);
