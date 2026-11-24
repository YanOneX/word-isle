# 词屿 · 离线背单词

一个离线优先的背单词 Web 应用：词书、看图选意、拼写、艾宾浩斯复习、学习统计与海报导出。纯 HTML/CSS/原生 ES Modules，无框架、无构建步骤，可在手机和电脑的浏览器里直接使用。

- 在线使用：<https://yanonex.github.io/word-isle/>
- 本地使用：Node.js 18+，双击 `启动.cmd`，浏览器打开 <http://127.0.0.1:8787/>

> 请通过 HTTP 服务打开，不要直接双击 `app/index.html`（浏览器会因 `file://` 限制无法加载词库 JSON）。GitHub Pages 和本地服务器都满足这个条件。

## 功能

- **首页**：今日新词/复习计划、单词卡（插画、音标、详解、美/英发音）、打卡周条与日历、英文/中文搜索。
- **词库**：50 本词书、分类筛选、词书详情、选关地图、错词本/生词本入口。
- **学习**：看图选意、看词识图、语境填空、混合模式；答错进入拼写补救；听写模式；提示/跳过；连击音效；键盘 1–4 / A–D。
- **复习**：第 1/7/30 天复习节点，答错重置；复习会话与总结。
- **统计**：本周/本月/全部、新词量与正确率、学习热力、掌握进度与预计完成日期、记忆分布、常错词、海报导出。
- **我的**：当前词书、错词本、生词本、贴纸图鉴、学习设置、备份导入导出、GitHub 同步、重置。
- **遮挡背词**：错词本/生词本里拖动色块遮住释义自测，八色可选。
- **其他**：首次引导、深色模式、移动端适配、刷新恢复进行中的学习。

## 数据与隐私

| 内容 | 位置 |
|---|---|
| 学习记录、每日统计、会话、错词/生词、贴纸、打卡 | IndexedDB `bwt_local` / `kv` / `bwt_data_v2` |
| 设置、当前词书、上次页面、遮挡色块、引导状态 | localStorage `bwt_config_v2` |
| GitHub 同步配置（仓库地址与 token） | localStorage `bwt_gh_sync_v1` |
| 单词插画缓存 | Cache Storage `bwt-images-v1` |

- 进度默认只保存在当前浏览器；清理浏览器数据会丢失。
- 建议定期在「我的 → 数据与备份 → 导出备份」保存 JSON。
- 导出的备份不包含 GitHub token；token 也不会随同步文件上传。
- IndexedDB 不可用时（极少数隐私模式）会自动回退到 localStorage。

## 多设备同步（GitHub 私有仓库）

同步是手动的，适合手机 ↔ 电脑。应用直接调用 GitHub API，不需要自己的服务器。

1. 新建一个**私有**仓库，例如 `word-isle-progress`：<https://github.com/new?name=word-isle-progress&visibility=private>
2. 生成 fine-grained token：<https://github.com/settings/personal-access-tokens/new>
   - Repository access：Only select repositories → `word-isle-progress`
   - Permissions → Contents：**Read and write**
   - 设置合理的过期时间
3. 打开应用 →「我的」→「GitHub 同步」→「设置」，填写 GitHub 用户名、仓库名、分支（默认 `main`）和 token。
4. 在旧设备点「上传本机进度」；在新设备填写同一个仓库和 token，点「从 GitHub 恢复」。

说明：

- token 保存在当前浏览器的 localStorage，等同密码；不要在公共电脑上保存，用完可在 GitHub 撤销，或在应用里「清除」配置。
- 以最后一次上传为准，不做自动合并。恢复会覆盖本机进度，操作前有二次确认。
- 同步文件固定为仓库根目录的 `state.json`；超过 20 MB 会被拒绝。

## 本地运行

```bash
node server.mjs
# 换端口：PORT=8788 node server.mjs
```

Windows 也可以双击 `启动.cmd`。服务器只使用 Node 内置模块，无需 `npm install`。

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/pages.yml`：推送到 `main` 后，Actions 会把 `app/` 发布为 Pages。

首次启用：仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**，然后手动运行一次 `Deploy Pages` workflow。

## 项目结构

```
word-isle/
├─ app/                       # 应用本体（Pages 发布目录）
│  ├─ index.html
│  ├─ css/app.css
│  ├─ js/
│  │  ├─ main.js              # 入口、路由、底部导航、主题
│  │  ├─ store.js             # 状态、复习算法、会话、统计、持久化
│  │  ├─ db.js                # IndexedDB 封装
│  │  ├─ data.js              # 词库/词典加载、搜索、插画缓存
│  │  ├─ github.js            # GitHub 私有仓库同步
│  │  ├─ speech.js            # Web Speech 发音
│  │  ├─ sfx.js               # Web Audio 合成音效
│  │  ├─ ui.js / util.js      # 通用组件与工具
│  │  └─ screens/             # 各页面
│  ├─ data/                   # books.json / words.json / dict.json
│  └─ assets/                 # 字体与原创 SVG 贴纸
├─ server.mjs                 # 本地静态服务器（默认 8787）
├─ 启动.cmd
├─ .github/workflows/pages.yml
└─ README.md
```

## 素材与使用范围

- 本仓库不包含从第三方页面抓取的音频、贴纸或分析资料；贴纸为项目内原创 SVG，音效由 Web Audio 实时合成。
- 单词插画在运行时按需从第三方 CDN 加载并缓存，不随本仓库分发；离线时使用本地占位图。若版权方有异议，可移除该加载逻辑。
- 词库数据仅供个人学习使用；如需商用，请自行确认词表与释义的授权。
