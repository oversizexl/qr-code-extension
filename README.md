# 划词生成二维码 Chrome 扩展

一款专业的 Chrome 浏览器扩展，支持在任意网页中选择文字并快速生成二维码。采用智能分层生成策略，优先使用离线生成确保速度和稳定性，同时支持自定义API和多重备用方案。

## ✨ 核心特性

### 🚀 智能生成策略
- **离线优先** - 使用本地 QRCode.js 库实现秒级生成，无需网络依赖
- **自定义API** - 支持配置专属二维码生成API，满足企业级需求
- **多重备用** - 集成多个免费API作为后备方案，确保100%成功率
- **防抖保护** - 2秒防抖机制防止重复请求，优化用户体验

### 📱 交互体验
- 🖱️ **智能划词** - 选择文字自动显示绿色生成按钮，位置自适应
- 🎯 **侧边栏展示** - 优雅的滑出式侧边栏，不干扰正常浏览
- 💾 **完整功能** - 支持复制文字、保存二维码、清空历史
- 🖱️ **右键支持** - 通过右键菜单快速生成二维码
- ⚙️ **灵活设置** - 可开关绿色按钮显示、配置API参数

### 🔧 技术亮点
- **大小写保护** - 智能识别CSS样式影响，确保二维码包含原始文本
- **统一后台处理** - 所有API请求在Service Worker中统一管理
- **详细调试日志** - 完整的生成流程日志，便于问题排查
- **响应式设计** - 支持各种屏幕尺寸和网页布局

## 🏗️ 生成策略详解

### 三层生成机制
```
1. 离线生成 (优先)
   ├── 本地 QRCode.js 库
   ├── 无网络依赖
   └── 速度最快

2. 自定义API (可选)
   ├── 用户配置的专属API
   ├── 支持自定义请求头
   └── 企业级集成

3. 备用API (保底)
   ├── QR Server API
   ├── QuickChart API
   └── API-Ninjas API
```

### 智能文本处理
- **CSS样式检测** - 自动识别并绕过 `text-transform` 等样式影响
- **DOM原始内容** - 直接提取DOM节点原始文本确保准确性
- **字符编码支持** - 完整支持Unicode字符和特殊符号

## 🚀 安装方法

### Chrome Web Store（推荐）
*即将上架...*

### 开发者模式安装
1. 下载或克隆此项目到本地
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 开启右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

## 📖 使用指南

### 基础使用
1. **划词生成**（推荐）
   - 在任意网页选择文字
   - 点击绿色 "📱 生成二维码" 按钮
   - 侧边栏滑出显示二维码和操作选项

2. **右键生成**
   - 选中文字后右键选择 "生成二维码"
   - 直接调用统一生成逻辑

3. **扩展管理**
   - 点击工具栏扩展图标查看历史记录
   - 管理设置和清空历史

### 高级配置

#### 自定义API设置
1. 点击扩展图标进入设置页面
2. 开启"自定义API"开关
3. 配置API参数：
   ```
   API地址: https://your-api.com/qr?text={TEXT}
   请求头: {"Authorization": "Bearer your-token"}
   超时时间: 5000ms (1-30秒)
   ```
4. 点击"测试API"验证配置
5. 保存设置

#### 按钮显示控制
- 可在设置中关闭绿色按钮显示
- 仍可通过右键菜单使用功能

## 🛠️ 技术架构

### 文件结构
```
├── manifest.json          # 扩展配置（Manifest V3）
├── background.js          # Service Worker - 统一API处理
├── content.js             # 内容脚本 - 页面交互逻辑
├── content.css            # 样式文件 - 按钮和侧边栏
├── popup.html             # 设置弹窗页面
├── popup.js               # 弹窗脚本 - 设置管理
├── qrcode.min.js          # QRCode.js库 - 离线生成
├── images/                # 图标资源
│   ├── icon16.png         # 16x16 工具栏图标
│   ├── icon48.png         # 48x48 扩展管理图标
│   └── icon128.png        # 128x128 商店图标
└── README.md              # 项目文档
```

### 核心模块

#### Content Script (content.js)
- 文本选择检测和按钮显示
- 智能位置计算和DOM文本提取
- 侧边栏UI管理和用户交互
- 防抖机制和状态管理

#### Service Worker (background.js)
- 统一API请求处理和错误恢复
- 自定义API配置管理
- 右键菜单注册和处理
- 存储管理和消息转发

#### Popup Interface (popup.js)
- 设置界面和历史记录管理
- API配置验证和测试
- 实时设置同步和状态保存

## 🔧 开发指南

### 本地开发
```bash
# 克隆项目
git clone <repo-url>

# 加载到Chrome
# 1. 打开 chrome://extensions/
# 2. 开启开发者模式
# 3. 加载已解压的扩展程序

# 开发调试
# 修改代码后点击扩展管理页面的刷新按钮
```

### 调试方法

#### Service Worker调试
1. 打开 `chrome://extensions/`
2. 找到扩展，点击"检查视图 service worker"
3. 在开发者工具中查看网络请求和日志

#### 内容脚本调试
1. 在网页上按F12打开开发者工具
2. 查看Console中的详细生成日志
3. 观察Network面板中的API请求

### 关键API

#### 消息通信
```javascript
// Content Script -> Service Worker
chrome.runtime.sendMessage({
  action: 'generateCustomAPI',
  text: selectedText,
  apiConfig: {...}
});

// Service Worker -> Content Script
chrome.tabs.sendMessage(tabId, {
  action: 'showQRSidebar',
  text: text,
  qrDataURL: dataURL
});
```

#### 存储操作
```javascript
// 保存设置
chrome.storage.local.set({
  useCustomApi: true,
  customApiUrl: 'https://api.example.com/qr?text={TEXT}',
  customApiHeaders: '{"Authorization": "Bearer token"}'
});

// 读取设置
chrome.storage.local.get(['useCustomApi', 'customApiUrl'], callback);
```

## 🐛 故障排除

### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 绿色按钮不显示 | 设置被关闭或页面加载问题 | 检查设置或刷新页面 |
| 二维码生成失败 | 网络问题或API配置错误 | 检查网络连接和API设置 |
| 自定义API不工作 | URL格式错误或缺少{TEXT}占位符 | 检查API配置格式 |
| 侧边栏不显示 | JavaScript错误或权限问题 | 查看控制台错误日志 |
| 大小写变化 | CSS样式影响 | 扩展已自动处理此问题 |

### 调试日志分析
```javascript
// 文本选择和按钮显示
"Selection.toString(): "ZZZ""
"DOM textContent: "ZZZ""
"Final selected text: "ZZZ""

// 生成策略执行
"✅ Custom API is enabled and properly configured"
"🔧 Requesting custom API generation from background script"
"📡 Background - Custom API response status: 200 OK"

// 防抖机制
"🚫 Button click ignored - already processing QR request"
"🔓 QR processing lock released"
```

## 📝 版本历史

### v2.0.0 (最新版本)
- ✅ **智能三层生成策略** - 离线优先 + 自定义API + 多重备用
- ✅ **统一后台处理** - 所有API请求移至Service Worker
- ✅ **大小写保护** - 智能绕过CSS样式影响
- ✅ **防抖优化** - 2秒防抖防止重复请求
- ✅ **设置分离** - 按钮显示与API配置独立控制
- ✅ **调试增强** - 完整的生成流程日志
- ✅ **代码重构** - 更好的错误处理和代码复用

### v1.0.0 (基础版本)
- ✅ 基础划词生成二维码功能
- ✅ 多API支持确保高成功率
- ✅ 优雅的侧边栏UI设计
- ✅ 右键菜单支持
- ✅ 历史记录管理

## 🏆 技术优势

### 对比其他二维码扩展
| 特性 | 本扩展 | 一般扩展 |
|------|--------|----------|
| 生成速度 | ⚡ 离线秒级 | 🐌 依赖网络 |
| 成功率 | 🎯 100% (三层备用) | ❓ 单一API风险 |
| 文本准确性 | ✅ CSS样式保护 | ❌ 可能大小写错误 |
| 企业集成 | 🏢 自定义API支持 | ❌ 无企业功能 |
| 用户体验 | 🎨 智能防抖+位置 | 🔄 可能重复请求 |

### 性能特点
- **首选离线生成** - 平均响应时间 < 100ms
- **智能降级策略** - 确保在任何网络环境下都能工作
- **内存优化** - 自动清理临时DOM和事件监听
- **并发控制** - 防抖机制避免资源浪费

## 📄 许可证

MIT License - 可自由使用、修改和分发

## 🤝 贡献指南

欢迎提交问题和改进建议！

### 贡献方式
1. Fork 此仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发规范
- 遵循现有代码风格和注释习惯
- 添加适当的调试日志
- 确保向后兼容性
- 更新相关文档

## 📮 联系支持

- 🐛 问题报告：[GitHub Issues](https://github.com/oversizexl/qr-code-extension/issues)
- 💡 功能建议：[GitHub Discussions](https://github.com/oversizexl/qr-code-extension/discussions)
- 📧 邮件联系：oversizexl@gmail.com

---

**享受便捷的二维码生成体验！** 🎉