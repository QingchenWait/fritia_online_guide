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
构建输出会给公告详情与插件 logo 加内容哈希版本参数，前端读取数据时也会绕过缓存，因此修改公告 Markdown 或远端插件 metadata/logo 后，重新部署即可刷新页面内容。工作流还会每 6 小时定时重建一次，用于同步插件远端信息变化。

构建脚本还会在仓库根目录生成 AstrBot 第三方插件源文件 `plugin_source.json`，并生成插件源展示页 `plugin-source.html`。用户可以复制部署后的 `plugin_source.json` 链接，在 AstrBot 插件管理/插件市场中添加为第三方插件源。

`plugin_source.json` 会输出 AstrBot 插件市场可直接读取的 `logo`、`stars`、`updated_at` 等字段；其中 `logo` 会使用部署后的绝对 URL，避免 AstrBot 面板把相对路径解析成本机地址。构建脚本还会同步生成 `plugin_source-md5.json`，供 AstrBot 判断自定义插件源缓存是否需要刷新。

如果需要调整 AstrBot 第三方插件源中的分类标签，可以直接编辑 `plugin_source.json` 中对应插件的 `tags` 数组。后续 `npm run build` 会保留这些手动编辑的 `tags`，不会被远端 `metadata.yaml` 覆盖；插件名称、描述、版本等字段仍会自动同步。

构建脚本同时兼容数组格式，例如 `{ "plugins": ["https://github.com/owner/repo"] }`。

## 部署到 GitHub Pages

把本仓库推送到 GitHub 后，在仓库设置中启用 Pages，并把 Source 选择为 `GitHub Actions`。工作流文件位于 `.github/workflows/pages.yml`。
