const dataRoot = new URL("assets/data/", window.location.href);

const formatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeUrl(value, fallback = "#") {
  try {
    const url = new URL(value, window.location.href);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

async function loadJson(file) {
  const url = new URL(file, dataRoot);
  url.searchParams.set("t", Date.now().toString());
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Cannot load ${file}`);
  }
  return response.json();
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}

function renderAnnouncements(items) {
  const list = document.querySelector("#announcement-list");
  if (!list) {
    return;
  }

  if (!items.length) {
    list.innerHTML = '<div class="plugin-empty">暂无公告。</div>';
    return;
  }

  list.innerHTML = items
    .slice(0, 4)
    .map((item) => {
      const pin = item.pinned ? '<span class="pin">置顶</span>' : "";
      const href = safeUrl(item.url);
      return `
        <a class="announcement-item" href="${href}">
          <span class="announcement-title">${pin}${escapeHtml(item.title)}</span>
          <span class="announcement-meta">${item.pinned ? "使用文档" : formatDate(item.date)}</span>
        </a>
      `;
    })
    .join("");
}

function renderPlugins(items) {
  const grid = document.querySelector("#plugin-grid");
  if (!grid) {
    return;
  }

  if (!items.length) {
    grid.innerHTML = '<div class="plugin-empty">暂无插件资源。</div>';
    return;
  }

  grid.innerHTML = items
    .map((item) => `
      <a class="plugin-card" href="${safeUrl(item.repo)}" target="_blank" rel="noopener noreferrer">
        <img class="plugin-logo" src="${safeUrl(item.logo)}" alt="" loading="lazy">
        <span class="plugin-body">
          <span class="plugin-title-row">
            <h4>${escapeHtml(item.display_name)}</h4>
            <span class="version-tag">${escapeHtml(item.version)}</span>
          </span>
          <p>${escapeHtml(item.desc)}</p>
        </span>
      </a>
    `)
    .join("");
}

async function main() {
  const [announcements, plugins] = await Promise.allSettled([
    loadJson("announcements.json"),
    loadJson("plugins.json")
  ]);

  if (announcements.status === "fulfilled") {
    renderAnnouncements(announcements.value);
  } else {
    renderAnnouncements([]);
  }

  if (plugins.status === "fulfilled") {
    renderPlugins(plugins.value);
  } else {
    renderPlugins([]);
  }
}

main();
