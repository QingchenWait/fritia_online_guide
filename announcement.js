const params = new URLSearchParams(window.location.search);
const slug = params.get("id") || "usage";

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

async function main() {
  const response = await fetch(`announcement/${encodeURIComponent(slug)}.json`);
  if (!response.ok) {
    setText("#article-title", "公告不存在");
    document.querySelector("#article-content").innerHTML = "<p>未找到对应公告，请返回首页重新选择。</p>";
    return;
  }

  const article = await response.json();
  document.title = `${article.title} | 芙提雅 ONLINE`;
  setText("#article-title", article.title);
  setText("#article-date", article.pinned ? "置顶公告" : article.date);
  document.querySelector("#article-content").innerHTML = article.html;
}

main();
