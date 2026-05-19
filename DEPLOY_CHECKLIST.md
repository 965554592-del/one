# Vida Auto — Deployment & SEO Checklist

## 1. 本地构建

```bash
# 完整构建（Vite + 预渲染 + Sitemap）
npm run build:client:full
```

产出目录：`dist/`

验证产出完整性：
- [ ] `dist/index.html` 存在且包含 Tawk.to 脚本
- [ ] `dist/sitemap.xml` 包含所有页面 URL
- [ ] `dist/robots.txt` 指向 sitemap
- [ ] `dist/products/<id>/index.html` 各产品详情静态页存在

---

## 2. 上传到 SiteGround

### 方式一：File Manager（推荐小量更新）
1. 登录 SiteGround → Site Tools → Site → File Manager
2. 进入 `public_html/` 目录
3. **删除旧文件**（保留 `.htaccess` 和其他非前端文件）
4. 上传 `dist/` 文件夹**内的所有内容**到 `public_html/`（注意是内容，不是 dist 文件夹本身）

### 方式二：SFTP（推荐批量更新）
1. Site Tools → Devs → SSH Keys Manager → 生成/获取 SSH 密钥
2. 使用 FileZilla / WinSCP：
   - 协议：SFTP
   - 主机：从 Site Tools → Dashboard 获取
   - 端口：18765
   - 用户名：对应 FTP 用户
3. 将 `dist/*` 上传覆盖到 `/home/<user>/public_html/`

### 方式三：SSH（高级）
```bash
scp -P 18765 -r dist/* <user>@<host>:/home/<user>/public_html/
```

---

## 3. 配置 .htaccess（SPA 路由 + 缓存）

在 `public_html/.htaccess` 中确保包含以下规则：

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # 如果请求的是真实文件或目录，直接返回
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d

  # 否则回退到 index.html（SPA 路由）
  RewriteRule ^ index.html [QSA,L]
</IfModule>

# 静态资源长期缓存（Vite 自动带 hash 文件名）
<IfModule mod_expires.c>
  ExpiresActive On
  ExpiresByType text/css "access plus 1 year"
  ExpiresByType application/javascript "access plus 1 year"
  ExpiresByType image/png "access plus 1 year"
  ExpiresByType image/jpeg "access plus 1 year"
  ExpiresByType image/svg+xml "access plus 1 year"
  ExpiresByType font/woff2 "access plus 1 year"
</IfModule>

# 启用 gzip
<IfModule mod_deflate.c>
  AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>
```

---

## 4. 清除 SiteGround 缓存

1. Site Tools → Speed → Caching
2. 点击 **Flush Cache**（Dynamic Cache + Static Cache）
3. 如果有 CDN → Speed → Cloudflare → Purge Cache

---

## 5. 验证网站正常运行

- [ ] 打开 `https://autoparts.fit/` → 首页正常
- [ ] 刷新 `https://autoparts.fit/products` → 非 404（.htaccess SPA 路由生效）
- [ ] 点击任意产品 → 详情页正常
- [ ] WhatsApp 浮窗显示在线/离线状态
- [ ] Tawk.to 聊天窗口右下角出现

---

## 6. Google Search Console 设置

### 6.1 验证网站所有权
1. 打开 https://search.google.com/search-console
2. 添加资源 → 选择"网域"或"网址前缀"
3. 推荐"网址前缀"：`https://autoparts.fit/`
4. 验证方式选择 **HTML 文件**或 **DNS TXT 记录**（SiteGround 域名管理处添加）

### 6.2 提交 Sitemap
1. 侧边栏 → Sitemap
2. 添加 `https://autoparts.fit/sitemap.xml`
3. 点击提交

### 6.3 请求索引
1. 在搜索栏粘贴 `https://autoparts.fit/` → 检查网址
2. 点击"请求编入索引"
3. 对重要页面重复此操作：
   - `https://autoparts.fit/products`
   - `https://autoparts.fit/about`

---

## 7. Meta Pixel 验证

1. 安装 Chrome 扩展：**Meta Pixel Helper**
2. 打开 `https://autoparts.fit/` → 确认 `PageView` 事件触发
3. 切换页面 → 每次路由变化都应触发 `PageView`
4. 提交询盘表单 → 确认 `Lead` 事件触发
5. 点击 WhatsApp "立即咨询" → 确认 `Contact` 事件触发
6. 在 [Meta Events Manager](https://business.facebook.com/events_manager) → 测试事件 中实时验证

---

## 8. Admin Dashboard 配置

登录后台 `https://autoparts.fit/admin` → Settings：

- [ ] **Meta Pixel ID**：填入你的 Pixel ID（如 `123456789012345`）
- [ ] **Working Hours**：设置工作时间（如 `MON-FRI 09:00-18:00;SAT 10:00-14:00`）
- [ ] **Timezone**：选择正确时区
- [ ] **WhatsApp Link**：确认已配置
- [ ] 点击 Save Settings

---

## 9. Firebase 设置确认

- [ ] Firebase Console → Authentication → Settings → Authorized domains：添加 `autoparts.fit`
- [ ] Firebase Console → Storage → Rules：确认已开启读写
- [ ] Firebase Console → Firestore → Rules：确认权限配置

---

## 10. 后端 (Render) 确认

- [ ] https://vida-api.onrender.com/api/health 返回正常
- [ ] 环境变量 `CORS_ORIGIN` 包含 `https://autoparts.fit`
- [ ] 注意 Render 免费套餐有 ~30s 冷启动

---

## Chunk 分包说明

| 文件 | 大小 | gzip | 说明 |
|------|------|------|------|
| `index-*.js` | 263 KB | 64 KB | 应用代码（首屏关键） |
| `vendor-react-*.js` | 50 KB | 18 KB | React 核心 |
| `vendor-firebase-*.js` | 504 KB | 118 KB | Firebase SDK（异步加载） |
| `vendor-three-*.js` | 1,106 KB | 308 KB | Three.js 3D 地球（lazy-loaded） |
| `vendor-i18n-*.js` | 50 KB | 16 KB | 国际化库 |
| `Globe-*.js` | 4 KB | 2 KB | 3D 地球业务组件（lazy-loaded） |

首屏只需加载 `index + vendor-react + CSS ≈ 91 KB gzip`，其余按需加载。
