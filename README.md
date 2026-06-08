# 芙提雅 ONLINE GitHub Pages

这是一个可直接部署到 GitHub Pages 的静态网站，用于展示 AstrBot 机器人 APP「芙提雅 ONLINE」的开发成果、功能说明和资源库。

## 本地预览

```bash
npm run build
npm run serve
```

默认预览地址是 `http://localhost:4173`。

## 更新公告

把新的 Markdown 文件放入 `publish/` 目录即可。文件名格式：

```text
公告标题内容-年月日.md
```

示例：

```text
插件资源库更新-2026-06-08.md
插件资源库更新-2026年06月08日.md
插件资源库更新-20260608.md
```

构建脚本会自动读取 `publish/*.md`，按文件名末尾日期倒序显示最新 3 条公告。置顶公告固定为「芙提雅 ONLINE 使用文档」，内容文件是 `publish/芙提雅 ONLINE 使用文档.md`。

公告 Markdown 支持常见标题、段落、列表、引用、代码块、链接、图片，也会保留内嵌 HTML。公式可使用 `$...$`、`$$...$$`、`\(...\)` 或 `\[...\]`，公告页会通过 MathJax 渲染。

## 更新插件资源

在 `plugin/plugins.json` 中追加键值，值为 GitHub 仓库地址：

```json
{
  "plugin-name": "https://github.com/owner/repo"
}
```

部署时 GitHub Actions 会运行：

```bash
npm run sync:plugins
npm run build
```

`sync:plugins` 会从每个 GitHub 仓库默认分支读取 `logo.png` 和 `metadata.yaml`，并缓存到 `plugin/<repo>/`。`build` 会读取 metadata 中的 `display_name`、`desc`、`version` 生成插件卡片。

构建脚本同时兼容数组格式，例如 `{ "plugins": ["https://github.com/owner/repo"] }`。

## 部署到 GitHub Pages

把本仓库推送到 GitHub 后，在仓库设置中启用 Pages，并把 Source 选择为 `GitHub Actions`。工作流文件位于 `.github/workflows/pages.yml`。
