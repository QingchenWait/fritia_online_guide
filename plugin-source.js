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

function sourceUrl() {
  return new URL("plugin_source.json", window.location.href).href;
}

function formatDate(value) {
  if (!value) {
    return "未知";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : formatter.format(date);
}

async function loadPlugins() {
  const url = new URL("assets/data/plugin-source-cards.json", window.location.href);
  url.searchParams.set("t", Date.now().toString());
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Cannot load plugin source cards");
  }
  return response.json();
}

function authorIcon() {
  return `
    <svg class="source-inline-icon source-author-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0"></path>
      <circle cx="12" cy="8" r="4"></circle>
    </svg>
  `;
}

function githubIcon() {
  return `
    <svg class="source-inline-icon source-github-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5a9.5 9.5 0 0 0-3 18.52c.48.08.66-.2.66-.46v-1.78c-2.68.58-3.25-1.14-3.25-1.14-.44-1.1-1.07-1.4-1.07-1.4-.88-.6.07-.58.07-.58.97.07 1.48 1 1.48 1 .86 1.47 2.25 1.05 2.8.8.09-.62.34-1.05.62-1.29-2.14-.24-4.38-1.07-4.38-4.75 0-1.05.38-1.9 1-2.57-.1-.24-.43-1.22.1-2.54 0 0 .81-.26 2.66.98A9.21 9.21 0 0 1 12 7.07c.82 0 1.64.11 2.41.32 1.85-1.24 2.66-.98 2.66-.98.53 1.32.2 2.3.1 2.54.62.67 1 1.52 1 2.57 0 3.69-2.25 4.51-4.39 4.75.35.3.66.9.66 1.81v2.48c0 .26.18.55.67.46A9.5 9.5 0 0 0 12 2.5Z"></path>
    </svg>
  `;
}

function renderCards(plugins) {
  const grid = document.querySelector("#source-plugin-grid");
  if (!grid) {
    return;
  }

  if (!plugins.length) {
    grid.innerHTML = '<div class="plugin-empty">插件源暂无插件。</div>';
    return;
  }

  grid.innerHTML = plugins.map((plugin) => `
    <article class="source-plugin-card">
      <div class="source-card-top">
        <img class="source-card-logo" src="${escapeHtml(plugin.logo)}" alt="" loading="lazy">
        <div class="source-card-title">
          <h3>${escapeHtml(plugin.display_name)}</h3>
          <p class="source-card-author">${authorIcon()}<span>${escapeHtml(plugin.author)}</span></p>
        </div>
      </div>
      <p class="source-card-desc">${escapeHtml(plugin.desc)}</p>
      <div class="source-card-meta">
        <span class="source-star-tag">★ ${Number(plugin.stars || 0)}</span>
        <span>AstrBot ${escapeHtml(plugin.astrbot_version || "未注明")}</span>
        <span>${escapeHtml(plugin.version || "latest")}</span>
      </div>
      <div class="source-card-extra">
        <span>更新：${formatDate(plugin.updated_at)}</span>
      </div>
      <div class="source-card-footer">
        <a class="source-card-link" href="${escapeHtml(plugin.repo)}" target="_blank" rel="noopener noreferrer">${githubIcon()}<span>GitHub 仓库</span></a>
      </div>
    </article>
  `).join("");
}

function copyButtons() {
  return Array.from(document.querySelectorAll("#copy-source-link, #sticky-copy-source-link"));
}

function setCopyButtonText(text) {
  copyButtons().forEach((button) => {
    button.textContent = text;
  });
}

async function copySourceLink() {
  const url = sourceUrl();
  try {
    await navigator.clipboard.writeText(url);
    setCopyButtonText("已复制订阅链接");
  } catch {
    window.prompt("复制订阅链接", url);
    setCopyButtonText("手动复制订阅链接");
  }
  window.setTimeout(() => {
    setCopyButtonText("一键复制订阅链接");
  }, 1800);
}

function setupStickyCopyButton() {
  const inlineButton = document.querySelector("#copy-source-link");
  const stickyButton = document.querySelector("#sticky-copy-source-link");
  const header = document.querySelector(".source-page-header");
  if (!inlineButton || !stickyButton || !header) {
    return;
  }

  const update = () => {
    const inlineRect = inlineButton.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    stickyButton.classList.toggle("is-visible", inlineRect.bottom <= headerRect.bottom + 8);
  };

  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

async function main() {
  copyButtons().forEach((button) => {
    button.addEventListener("click", copySourceLink);
  });
  setupStickyCopyButton();

  try {
    const plugins = await loadPlugins();
    renderCards(plugins);
  } catch {
    renderCards([]);
  }
}

main();
