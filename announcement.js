const params = new URLSearchParams(window.location.search);
const slug = params.get("id") || "usage";
const version = params.get("v") || "";

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

function typesetMath(container) {
  const run = () => {
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise([container]).catch((error) => {
        console.warn("MathJax typeset failed:", error);
      });
    }
  };

  if (window.MathJax?.typesetPromise) {
    run();
  } else {
    window.addEventListener("load", run, { once: true });
  }
}

async function main() {
  const articleUrl = new URL(`announcement/${encodeURIComponent(slug)}.json`, window.location.href);
  if (version) {
    articleUrl.searchParams.set("v", version);
  }
  articleUrl.searchParams.set("t", Date.now().toString());
  const response = await fetch(articleUrl, { cache: "no-store" });
  const content = document.querySelector("#article-content");
  if (!response.ok) {
    setText("#article-title", "公告不存在");
    content.innerHTML = "<p>未找到对应公告，请返回首页重新选择。</p>";
    return;
  }

  const article = await response.json();
  document.title = `${article.title} | 芙提雅 ONLINE`;
  setText("#article-title", article.title);
  setText("#article-date", article.pinned ? "置顶公告" : article.date);
  content.innerHTML = article.html;
  typesetMath(content);
}

main();
