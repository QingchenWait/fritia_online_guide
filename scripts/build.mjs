import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const root = process.cwd();
const publishDir = path.join(root, "publish");
const pluginDir = path.join(root, "plugin");
const announcementDir = path.join(root, "announcement");
const dataDir = path.join(root, "assets", "data");
const pluginSourceFile = path.join(root, "plugin_source.json");

const usageTitle = "芙提雅 ONLINE 使用文档";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  const encoded = encodeURIComponent(value.trim())
    .replaceAll("%", "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return encoded || "article";
}

function contentHash(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function parseAnnouncementFilename(filename) {
  const base = filename.replace(/\.md$/i, "");
  const dashed = base.match(/^(.*)-(\d{4})-(\d{2})-(\d{2})$/);
  const chinese = base.match(/^(.*)-(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  const compact = base.match(/^(.*)-(\d{4})(\d{2})(\d{2})$/);
  const match = dashed || chinese || compact;
  if (!match) {
    return null;
  }
  const month = match[3].padStart(2, "0");
  const day = match[4].padStart(2, "0");
  return {
    title: match[1].trim(),
    date: `${match[2]}-${month}-${day}`
  };
}

function inlineMarkdown(value) {
  const rawSegments = [];
  const rawTokenPrefix = "RAW_HTML_OR_MATH_SEGMENT_";
  const rawPattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+\$|<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?>|&(?:[A-Za-z][A-Za-z0-9]+|#[0-9]+|#x[0-9A-Fa-f]+);)/g;
  const preserved = value.replace(rawPattern, (match) => {
    const token = `${rawTokenPrefix}${rawSegments.length}__`;
    rawSegments.push(match);
    return token;
  });

  let text = escapeHtml(preserved);
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  for (let index = 0; index < rawSegments.length; index += 1) {
    text = text.replaceAll(`${rawTokenPrefix}${index}__`, rawSegments[index]);
  }
  return text;
}

const htmlBlockTags = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "canvas",
  "details",
  "dialog",
  "div",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "iframe",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "ul",
  "video"
]);

const rawHtmlTags = new Set(["script", "style"]);
const markdownContainerTags = new Set([
  "article",
  "aside",
  "details",
  "div",
  "figure",
  "footer",
  "header",
  "main",
  "nav",
  "section"
]);

function getHtmlBlockTag(line) {
  const match = line.trimStart().match(/^<([A-Za-z][A-Za-z0-9-]*)(?:\s|>|\/>)/);
  if (!match) {
    return null;
  }
  const tag = match[1].toLowerCase();
  return htmlBlockTags.has(tag) || rawHtmlTags.has(tag) ? tag : null;
}

function getStandaloneContainerTag(line) {
  const trimmed = line.trim();
  const match = trimmed.match(/^<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?>$/);
  if (!match || trimmed.endsWith("/>")) {
    return null;
  }
  const tag = match[1].toLowerCase();
  return markdownContainerTags.has(tag) ? tag : null;
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let paragraph = [];
  let list = null;
  let blockquote = [];
  let code = null;
  let htmlBlock = null;
  let mathBlock = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  const flushList = () => {
    if (list) {
      html.push(`<${list.type}>${list.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${list.type}>`);
      list = null;
    }
  };

  const flushBlockquote = () => {
    if (blockquote.length) {
      html.push(`<blockquote>${markdownToHtml(blockquote.join("\n"))}</blockquote>`);
      blockquote = [];
    }
  };

  const flushCode = () => {
    if (code) {
      html.push(`<pre><code>${escapeHtml(code.lines.join("\n"))}</code></pre>`);
      code = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (mathBlock) {
      const trimmed = line.trim();
      if (trimmed === mathBlock.close) {
        html.push(`<div class="math-block">${mathBlock.open}\n${mathBlock.lines.join("\n")}\n${mathBlock.close}</div>`);
        mathBlock = null;
      } else {
        mathBlock.lines.push(rawLine);
      }
      continue;
    }

    if (htmlBlock) {
      htmlBlock.lines.push(rawLine);
      const lower = line.toLowerCase();
      if (htmlBlock.selfClosing || lower.includes(`</${htmlBlock.tag}>`)) {
        html.push(htmlBlock.lines.join("\n"));
        htmlBlock = null;
      }
      continue;
    }

    if (line.startsWith("```")) {
      if (code) {
        flushCode();
      } else {
        flushParagraph();
        flushList();
        flushBlockquote();
        code = { lines: [] };
      }
      continue;
    }

    if (code) {
      code.lines.push(rawLine);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed === "$$" || trimmed === "\\[") {
      flushParagraph();
      flushList();
      flushBlockquote();
      mathBlock = {
        open: trimmed,
        close: trimmed === "$$" ? "$$" : "\\]",
        lines: []
      };
      continue;
    }

    if (getStandaloneContainerTag(line)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      html.push(rawLine);
      continue;
    }

    const htmlTag = getHtmlBlockTag(line);
    if (htmlTag) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const lower = trimmed.toLowerCase();
      if (trimmed.endsWith("/>") || lower.includes(`</${htmlTag}>`) || htmlTag === "hr") {
        html.push(rawLine);
      } else {
        htmlBlock = {
          tag: htmlTag,
          selfClosing: trimmed.endsWith("/>"),
          lines: [rawLine]
        };
      }
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushBlockquote();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      blockquote.push(line.replace(/^>\s?/, ""));
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      flushBlockquote();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      flushBlockquote();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushCode();
  if (mathBlock) {
    html.push(`<div class="math-block">${mathBlock.open}\n${mathBlock.lines.join("\n")}</div>`);
  }
  if (htmlBlock) {
    html.push(htmlBlock.lines.join("\n"));
  }
  flushParagraph();
  flushList();
  flushBlockquote();

  return html.join("\n");
}

function parseYamlScalar(value = "") {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseMetadataYaml(source) {
  const data = {};
  let currentKey = null;
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      currentKey = match[1];
      const value = match[2].trim();
      data[currentKey] = value ? parseYamlScalar(value) : [];
      continue;
    }

    const item = line.match(/^\s+-\s*(.*)$/);
    if (item && currentKey) {
      if (!Array.isArray(data[currentKey])) {
        data[currentKey] = data[currentKey] ? [data[currentKey]] : [];
      }
      data[currentKey].push(parseYamlScalar(item[1]));
    }
  }
  return data;
}

function parseGitHubRepo(url) {
  const match = String(url).match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2]
  };
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String);
  }
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return ["AstrBot", "青尘工作室"];
}

function sourceKey(repo, metadata, repoName) {
  return metadata.name || parseGitHubRepo(repo)?.repo || repoName;
}

async function readExistingPluginSource() {
  return readFile(pluginSourceFile, "utf8")
    .then(JSON.parse)
    .catch(() => ({}));
}

function findExistingPluginSourceEntry(existingPluginSource, key, repo) {
  if (existingPluginSource[key] && typeof existingPluginSource[key] === "object") {
    return existingPluginSource[key];
  }
  return Object.values(existingPluginSource).find((item) => (
    item &&
    typeof item === "object" &&
    typeof item.repo === "string" &&
    item.repo.replace(/\/$/, "") === repo.replace(/\/$/, "")
  ));
}

async function ensureDirs() {
  await mkdir(announcementDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });
}

async function buildAnnouncements() {
  const entries = [];
  const files = await readdir(publishDir).catch(() => []);
  const oldGeneratedFiles = await readdir(announcementDir).catch(() => []);
  await Promise.all(
    oldGeneratedFiles
      .filter((file) => file.endsWith(".json"))
      .map((file) => unlink(path.join(announcementDir, file)).catch(() => {}))
  );

  const usageFile = path.join(publishDir, `${usageTitle}.md`);
  const usageMarkdown = await readFile(usageFile, "utf8").catch(() => `# ${usageTitle}\n\n使用文档尚未创建。`);
  const usageHash = contentHash(usageMarkdown);
  const usage = {
    title: usageTitle,
    date: "",
    slug: "usage",
    pinned: true,
    hash: usageHash,
    url: `announcement.html?id=usage&v=${usageHash}`,
    html: markdownToHtml(usageMarkdown)
  };
  await writeFile(path.join(announcementDir, "usage.json"), JSON.stringify(usage, null, 2), "utf8");
  entries.push({
    title: usage.title,
    date: usage.date,
    slug: usage.slug,
    pinned: true,
    hash: usage.hash,
    url: usage.url
  });

  const announcements = [];
  for (const file of files) {
    if (!file.endsWith(".md") || file === `${usageTitle}.md`) {
      continue;
    }

    const parsed = parseAnnouncementFilename(file);
    if (!parsed) {
      continue;
    }

    const markdown = await readFile(path.join(publishDir, file), "utf8");
    const hash = contentHash(markdown);
    const slug = slugify(`${parsed.title}-${parsed.date}`);
    const item = {
      title: parsed.title,
      date: parsed.date,
      slug,
      pinned: false,
      hash,
      url: `announcement.html?id=${slug}&v=${hash}`,
      html: markdownToHtml(markdown)
    };
    await writeFile(path.join(announcementDir, `${slug}.json`), JSON.stringify(item, null, 2), "utf8");
    announcements.push(item);
  }

  announcements.sort((a, b) => b.date.localeCompare(a.date));
  entries.push(...announcements.slice(0, 3).map(({ title, date, slug, pinned, hash, url }) => ({ title, date, slug, pinned, hash, url })));

  await writeFile(path.join(dataDir, "announcements.json"), JSON.stringify(entries, null, 2), "utf8");
}

async function readPluginList() {
  const file = path.join(pluginDir, "plugins.json");
  const raw = await readFile(file, "utf8").catch(() => '{"plugins":[]}');
  const data = JSON.parse(raw);
  if (Array.isArray(data)) {
    return [...new Set(data)];
  }
  const repos = [];
  if (Array.isArray(data.plugins)) {
    repos.push(...data.plugins);
  } else if (data.plugins && typeof data.plugins === "object") {
    repos.push(...Object.values(data.plugins));
  }
  repos.push(
    ...Object.entries(data)
      .filter(([key, value]) => key !== "plugins" && typeof value === "string")
      .map(([, value]) => value)
  );
  return [...new Set(repos)];
}

function repoNameFromUrl(url) {
  const cleaned = url.replace(/\/$/, "").replace(/\.git$/, "");
  return cleaned.split("/").pop();
}

async function buildPlugins() {
  const repos = await readPluginList();
  const plugins = [];
  const pluginSource = {};
  const pluginSourceCards = [];
  const existingPluginSource = await readExistingPluginSource();

  for (const repo of repos) {
    if (typeof repo !== "string" || !repo.trim()) {
      continue;
    }

    const repoName = repoNameFromUrl(repo);
    const folder = path.join(pluginDir, repoName);
    const metadataPath = path.join(folder, "metadata.yaml");
    const logoPath = path.join(folder, "logo.png");
    const repoInfoPath = path.join(folder, "repo.json");
    const metadataSource = await readFile(metadataPath, "utf8").catch(() => "");
    const metadata = metadataSource ? parseMetadataYaml(metadataSource) : {};
    const repoInfo = await readFile(repoInfoPath, "utf8").then(JSON.parse).catch(() => ({}));
    const logoSource = await readFile(logoPath).catch(() => null);
    const logoHash = logoSource ? contentHash(logoSource) : "fallback";
    const pluginHash = contentHash(`${repo}\n${metadataSource}\n${JSON.stringify(repoInfo)}\n${logoHash}`);
    const key = sourceKey(repo, metadata, repoName);
    const author = metadata.author || repoInfo.owner || parseGitHubRepo(repo)?.owner || "青尘工作室";
    const displayName = metadata.display_name || metadata.name || repoName;
    const desc = metadata.desc || metadata.short_desc || repoInfo.description || "插件描述待补充。";
    const version = metadata.version || "latest";
    const existingPlugin = findExistingPluginSourceEntry(existingPluginSource, key, repo);
    const tags = Object.hasOwn(existingPlugin || {}, "tags")
      ? normalizeTags(existingPlugin.tags)
      : normalizeTags(metadata.tags);
    const declaredAstrbotVersion = metadata.astrbot_version || metadata.astrbot_version_requirement || "";
    const astrbotVersion = declaredAstrbotVersion || "未注明";
    const supportPlatforms = Array.isArray(metadata.support_platforms) ? metadata.support_platforms : [];
    const logo = logoSource ? `plugin/${repoName}/logo.png?v=${logoHash}` : "assets/logo.png";

    plugins.push({
      repo,
      display_name: displayName,
      desc,
      version,
      hash: pluginHash,
      logo,
      logo_missing: !logoSource
    });

    pluginSource[key] = {
      display_name: displayName,
      desc,
      author,
      repo,
      tags,
      version
    };

    if (declaredAstrbotVersion) {
      pluginSource[key].astrbot_version = declaredAstrbotVersion;
    }

    if (metadata.short_desc) {
      pluginSource[key].short_desc = metadata.short_desc;
    }
    if (metadata.social_link) {
      pluginSource[key].social_link = metadata.social_link;
    } else if (repoInfo.owner) {
      pluginSource[key].social_link = `https://github.com/${repoInfo.owner}`;
    }

    pluginSourceCards.push({
      key,
      repo,
      display_name: displayName,
      desc,
      short_desc: metadata.short_desc || desc,
      author,
      version,
      astrbot_version: astrbotVersion,
      support_platforms: supportPlatforms,
      tags,
      stars: repoInfo.stargazers_count || 0,
      forks: repoInfo.forks_count || 0,
      updated_at: repoInfo.pushed_at || repoInfo.updated_at || "",
      hash: pluginHash,
      logo
    });
  }

  const resolved = plugins.map((plugin) => ({
    ...plugin,
    logo: plugin.logo_missing ? "assets/logo.png" : plugin.logo
  })).map(({ logo_missing, ...plugin }) => plugin);

  await writeFile(path.join(dataDir, "plugins.json"), JSON.stringify(resolved, null, 2), "utf8");
  await writeFile(path.join(dataDir, "plugin-source-cards.json"), JSON.stringify(pluginSourceCards, null, 2), "utf8");
  await writeFile(pluginSourceFile, JSON.stringify(pluginSource, null, 2), "utf8");
}

await ensureDirs();
await buildAnnouncements();
await buildPlugins();

console.log("Built static data.");
