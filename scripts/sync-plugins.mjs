import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const pluginDir = path.join(root, "plugin");

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

function parseGitHubRepo(url) {
  const match = url.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2]
  };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "User-Agent": "fritia-online-guide"
    }
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchBinary(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github.raw",
      "User-Agent": "fritia-online-guide"
    }
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function getDefaultBranch(owner, repo) {
  const raw = await fetchText(`https://api.github.com/repos/${owner}/${repo}`);
  return JSON.parse(raw).default_branch || "main";
}

async function syncRepo(url) {
  const parsed = parseGitHubRepo(url);
  if (!parsed) {
    console.warn(`Skip non-GitHub repo: ${url}`);
    return;
  }

  let branch = "main";
  try {
    branch = await getDefaultBranch(parsed.owner, parsed.repo);
  } catch (error) {
    console.warn(`Cannot read ${parsed.owner}/${parsed.repo} default branch: ${error.message}`);
    return;
  }
  const targetDir = path.join(pluginDir, parsed.repo);
  await mkdir(targetDir, { recursive: true });

  const base = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${branch}`;
  const files = [
    ["metadata.yaml", `${base}/metadata.yaml`, "text"],
    ["logo.png", `${base}/logo.png`, "binary"]
  ];

  for (const [filename, fileUrl, type] of files) {
    try {
      const content = type === "binary" ? await fetchBinary(fileUrl) : await fetchText(fileUrl);
      await writeFile(path.join(targetDir, filename), content);
      console.log(`Synced ${parsed.repo}/${filename}`);
    } catch (error) {
      console.warn(`Cannot sync ${parsed.repo}/${filename}: ${error.message}`);
    }
  }
}

const repos = await readPluginList();
for (const repo of repos) {
  await syncRepo(repo);
}
