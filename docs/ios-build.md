# iOS 打包说明

## 当前状态

项目已经完成 Capacitor 通用配置，并安装 `@capacitor/ios` 依赖。

Windows 上不能生成和编译 iOS 原生工程，后续需要在 macOS 上继续。

## Mac 环境要求

- macOS
- Xcode
- Node.js 22
- Apple Developer 账号
- 可用的开发证书和描述文件

## 生成 iOS 工程

在 Mac 上进入仓库根目录：

```bash
npm run install:all
cd client
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

## 后端地址

iOS App 不能使用 `localhost` 访问电脑或服务器后端。

测试服建议使用域名：

```env
VITE_BACKEND_WS_URL="ws://你的测试服域名或IP:45170"
VITE_BACKEND_HTTP_URL="http://你的测试服域名或IP:45170"
```

生产环境建议使用 HTTPS / WSS：

```env
VITE_BACKEND_WS_URL="wss://api.example.com"
VITE_BACKEND_HTTP_URL="https://api.example.com"
```

修改环境变量后重新执行：

```bash
npm run build
npx cap sync ios
```

## Xcode 检查项

- Bundle Identifier：`com.yokonex.bomberman`
- Display Name：`Bomberman Yokonex`
- Signing Team：选择开发者账号团队
- Deployment Target：按 Xcode 默认或业务要求设置
- 网络权限：测试 HTTP 时需要确认 ATS 配置，正式环境建议使用 HTTPS / WSS

## 验证流程

1. Xcode 选择 iOS Simulator，点击 Run。
2. App 能启动到登录页。
3. 登录 / 注册接口能访问测试服。
4. 能进入大厅。
5. 能创建或加入房间。
6. WebSocket 能正常连接 Colyseus 服务端。

## 注意事项

- iOS 真机调试必须用证书签名。
- iOS 上 Web Bluetooth 不适合作为 EMS 真实设备方案，后续真机 EMS 需要接原生 BLE 插件。
- iOS 包体和权限说明要在上线前和隐私协议一起检查。
