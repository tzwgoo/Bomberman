# Android 打包说明

## 环境要求

- Node.js 22 或更高版本
- JDK 17 或更高版本，推荐 JDK 21
- Android SDK 及 Android SDK Platform 36
- 已设置 `ANDROID_HOME` 或 `ANDROID_SDK_ROOT`
- `JAVA_HOME` 已指向上述 JDK，不能指向旧版 Java 8

Windows 当前终端可这样设置：

```powershell
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
```

## 后端地址

首次打包前复制 Android 环境变量模板：

```powershell
Copy-Item client/.env.android.example client/.env.android
```

Android 模拟器访问电脑本机服务时使用默认的 `10.0.2.2:45170`。

真机或测试包必须把 `client/.env.android` 改为手机可访问的测试服地址：

```env
VITE_BACKEND_WS_URL="wss://api.example.com"
VITE_BACKEND_HTTP_URL="https://api.example.com"
```

`client/.env.android` 已忽略，不会提交真实测试服配置。

## 构建 Debug APK

在仓库根目录执行：

```bash
npm run android:build:debug
```

命令会依次完成：

1. 使用 Android 模式构建 Web 资源。
2. 执行 Capacitor Android 同步。
3. 执行 Gradle `assembleDebug`。

APK 输出位置：

```text
client/android/app/build/outputs/apk/debug/app-debug.apk
```

## 只同步或打开工程

```bash
npm run android:sync
npm --prefix client run android:open
```

修改前端代码或环境变量后，必须重新同步或重新构建 APK。

## 安装验证

连接模拟器或开启 USB 调试的手机后执行：

```bash
adb install -r client/android/app/build/outputs/apk/debug/app-debug.apk
```

至少检查：

- App 启动后保持横屏。
- 能打开登录页并访问测试服。
- 能进入大厅、创建或加入房间。
- WebSocket 能正常连接。
