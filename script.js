/* RiaWrites — CMS-powered diary. No build tools required. */
(() => {
  "use strict";

  const OWNER = "teamriawrites-0608";
  const REPO = "teamriawrites-0608.github.io";
  const BRANCH = "main";
  const POSTS_PATH = "content/posts";
  const CATEGORIES = ["Dear Me", "Work in Progress", "Little Things", "Figuring It Out", "Life Lately"];

  const grid = document.querySelector(".post-grid");
  const filters = document.querySelector(".filter-row");
  const empty = document.querySelector(".empty-state");
  const archive = document.querySelector(".archive-list");
  let posts = [];
  let activeFilter = "All";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  })[c]);

  function parseScalar(value) {
    const v = String(value ?? "").trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
    if (v === "true" || v === "false") return v;
    if (v === "null" || v === "~") return "";
    return v;
  }

  function parseFrontmatter(source) {
    const match = String(source).replace(/^\uFEFF/, "").match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)([\s\S]*)$/);
    if (!match) return null;
    const meta = {};
    let key = "";
    for (const line of match[1].split(/\r?\n/)) {
      const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (m) {
        key = m[1];
        meta[key] = parseScalar(m[2]);
      } else if (key && /^\s+/.test(line)) {
        meta[key] = `${meta[key] || ""}\n${line.trim()}`;
      }
    }
    return {...meta, body: match[2].trim()};
  }

  function safeUrl(raw) {
    const value = String(raw || "").trim();
    if (!value) return "";
    if (/^(https?:\/\/|\/)/i.test(value)) return value;
    return "";
  }

  function inlineMarkdown(text) {
    let s = esc(text);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
    s = s.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    return s;
  }

  function markdownToHTML(markdown) {
    const lines = String(markdown || "").replace(/\r/g, "").split("\n");
    const out = [];
    let paragraph = [], list = null, quote = [];

    const flushP = () => {
      if (paragraph.length) { out.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`); paragraph = []; }
    };
    const flushList = () => {
      if (list) { out.push(`<${list.tag}>${list.items.map(x => `<li>${inlineMarkdown(x)}</li>`).join("")}</${list.tag}>`); list = null; }
    };
    const flushQuote = () => {
      if (quote.length) { out.push(`<blockquote>${quote.map(x => `<p>${inlineMarkdown(x)}</p>`).join("")}</blockquote>`); quote = []; }
    };

    for (const line of lines) {
      const t = line.trim();
      if (!t) { flushP(); flushList(); flushQuote(); continue; }
      const heading = t.match(/^(#{1,4})\s+(.+)$/);
      const bullet = t.match(/^[-*+]\s+(.+)$/);
      const numbered = t.match(/^\d+[.)]\s+(.+)$/);
      if (heading) {
        flushP(); flushList(); flushQuote();
        const level = Math.min(heading[1].length + 1, 6);
        out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      } else if (bullet || numbered) {
        flushP(); flushQuote();
        const tag = bullet ? "ul" : "ol";
        if (!list || list.tag !== tag) { flushList(); list = {tag, items:[]}; }
        list.items.push((bullet || numbered)[1]);
      } else if (t.startsWith(">")) {
        flushP(); flushList(); quote.push(t.replace(/^>\s?/, ""));
      } else {
        flushList(); flushQuote(); paragraph.push(t);
      }
    }
    flushP(); flushList(); flushQuote();
    return out.join("\n");
  }

  function dateObj(date) {
    const d = new Date(`${date || ""}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function formatDate(date) {
    const d = dateObj(date);
    return d ? d.toLocaleDateString("en-IN", {day:"numeric", month:"long", year:"numeric"}) : "";
  }
  function slugFromFile(name) { return name.replace(/\.md$/i, ""); }

  function applyFilter(category) {
    activeFilter = category;
    if (!grid) return;
    let visible = 0;
    grid.querySelectorAll(".post-card").forEach(card => {
      const show = category === "All" || card.dataset.category === category;
      card.hidden = !show;
      if (show) visible++;
    });
    if (empty) {
      empty.hidden = visible !== 0;
      if (visible === 0) empty.textContent = "No notes in this chapter just yet. Come back soon ♡";
    }
    if (filters) filters.querySelectorAll(".filter").forEach(btn => {
      const active = btn.dataset.filter === category;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function renderFilters() {
    if (!filters) return;
    filters.innerHTML = [
      '<button class="filter active" type="button" data-filter="All" aria-pressed="true">Everything</button>',
      ...CATEGORIES.map(c => `<button class="filter" type="button" data-filter="${esc(c)}" aria-pressed="false">${esc(c)}</button>`)
    ].join("");
  }

  function renderPosts() {
    if (!grid) return;
    if (!posts.length) {
      grid.innerHTML = "";
      if (empty) { empty.hidden = false; empty.textContent = "No published notes just yet. Come back soon ♡"; }
      return;
    }
    grid.innerHTML = posts.map(post => {
      const imageUrl = safeUrl(post.cover_image);
      const href = `#article=${encodeURIComponent(post.slug)}`;
      return `<article class="post-card" data-category="${esc(post.category)}">
        <a class="post-image" href="${href}" aria-label="Read ${esc(post.title)}">
          ${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(post.title)}" loading="lazy">` : ""}
          <span class="image-stamp">${esc(post.category || "DIARY")}</span>
        </a>
        <p class="post-meta">${esc(post.category || "DIARY")} <span>·</span> ${esc(formatDate(post.date))}</p>
        <h3><a href="${href}">${esc(post.title)}</a></h3>
        <p class="post-description">${esc(post.excerpt || "")}</p>
        <a class="read-more" href="${href}">Read the note <span>↗</span></a>
      </article>`;
    }).join("");
    if (empty) empty.hidden = true;
    applyFilter(activeFilter);
  }

  function renderArchive() {
    if (!archive) return;
    if (!posts.length) { archive.innerHTML = '<p class="archive-loading">Your archive will appear here when notes are published ♡</p>'; return; }
    const groups = new Map();
    posts.forEach(post => {
      const d = dateObj(post.date);
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      if (!groups.has(key)) groups.set(key, {year:d.getFullYear(), month:d.toLocaleDateString("en-IN",{month:"long"}), count:0});
      groups.get(key).count++;
    });
    archive.innerHTML = [...groups.entries()].sort((a,b) => b[0].localeCompare(a[0])).map(([key,g]) =>
      `<a href="#archive-month=${key}" data-month="${key}"><span>${g.year}</span><span>${esc(g.month)} <small>— notes from this month</small></span><span class="archive-count">${g.count} ${g.count===1?"NOTE":"NOTES"} ↗</span></a>`
    ).join("");
  }

  function showMainSections() {
    document.querySelectorAll("main > section").forEach(section => section.hidden = false);
    const detail = document.querySelector("#article-detail");
    if (detail) detail.hidden = true;
  }

  function renderArticle(post) {
    let detail = document.querySelector("#article-detail");
    if (!detail) {
      detail = document.createElement("section");
      detail.id = "article-detail";
      detail.className = "article-detail wrap";
      document.querySelector("main").appendChild(detail);
    }
    const imageUrl = safeUrl(post.cover_image);
    detail.innerHTML = `<a class="text-link" href="#latest">← Back to the diary</a>
      <p class="eyebrow">${esc(post.category || "DIARY")}</p>
      <h1>${esc(post.title)}</h1>
      <p class="post-meta">${esc(formatDate(post.date))}</p>
      ${imageUrl ? `<img class="article-cover" src="${esc(imageUrl)}" alt="${esc(post.title)}">` : ""}
      <div class="article-body">${markdownToHTML(post.body)}</div>`;
    document.querySelectorAll("main > section").forEach(section => section.hidden = section === detail ? false : true);
    detail.hidden = false;
    window.scrollTo({top:0, behavior:"smooth"});
    document.title = `${post.title} — Ria Writes`;
  }

  function showNotFound(slug) {
    let detail = document.querySelector("#article-detail");
    if (!detail) {
      detail = document.createElement("section");
      detail.id = "article-detail";
      detail.className = "article-detail wrap";
      document.querySelector("main").appendChild(detail);
    }
    detail.innerHTML = `<a class="text-link" href="#latest">← Back to the diary</a><h1>This note is taking a little detour.</h1><p>We couldn't find “${esc(slug)}”. It may have been unpublished or moved.</p>`;
    document.querySelectorAll("main > section").forEach(section => section.hidden = section === detail ? false : true);
    detail.hidden = false;
    document.title = "Note not found — Ria Writes";
  }

  function handleRoute() {
    const articleMatch = location.hash.match(/^#article=(.*)$/);
    const monthMatch = location.hash.match(/^#archive-month=(\d{4}-\d{2})$/);
    if (articleMatch) {
      let slug = articleMatch[1];
      try { slug = decodeURIComponent(slug); } catch {}
      const found = posts.find(p => p.slug === slug);
      if (found) renderArticle(found);
      else if (posts.length) showNotFound(slug);
      return;
    }
    showMainSections();
    document.title = "Ria Writes — A little bit of everything";
    if (monthMatch) {
      const key = monthMatch[1];
      applyFilter("All");
      const matching = posts.filter(p => {
        const d = dateObj(p.date);
        return d && `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}` === key;
      });
      if (grid) {
        grid.querySelectorAll(".post-card").forEach(card => {
          const post = posts.find(p => card.querySelector("h3 a")?.getAttribute("href") === `#article=${encodeURIComponent(p.slug)}`);
          card.hidden = !post || !matching.includes(post);
        });
      }
      const count = matching.length;
      if (empty) { empty.hidden = count > 0; empty.textContent = count ? "" : "No notes were published in this month."; }
      document.querySelector("#latest")?.scrollIntoView({behavior:"smooth"});
    }
  }

  async function loadPosts() {
    if (!grid) return;
    grid.innerHTML = '<p class="loading-note">Opening the diary… ♡</p>';
    try {
      const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${POSTS_PATH}?ref=${BRANCH}`;
      const response = await fetch(url, {headers:{Accept:"application/vnd.github+json"}});
      if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
      const files = await response.json();
      if (!Array.isArray(files)) throw new Error("The article folder response was not a file list.");
      const markdownFiles = files.filter(f => f.type === "file" && /\.md$/i.test(f.name));
      const records = await Promise.all(markdownFiles.map(async file => {
        const r = await fetch(file.download_url);
        if (!r.ok) return null;
        const parsed = parseFrontmatter(await r.text());
        if (!parsed) return null;
        const published = String(parsed.published).toLowerCase() === "true";
        if (!published) return null;
        return {...parsed, slug:slugFromFile(file.name), title:parsed.title || "Untitled note"};
      }));
      posts = records.filter(Boolean).sort((a,b) => (dateObj(b.date)?.getTime() || 0) - (dateObj(a.date)?.getTime() || 0));
      renderFilters();
      renderPosts();
      renderArchive();
      handleRoute();
    } catch (error) {
      console.error("RiaWrites CMS error:", error);
      grid.innerHTML = '<p class="loading-note">The diary could not load right now. Please refresh in a moment ♡</p>';
      if (archive) archive.innerHTML = '<p class="archive-loading">The archive could not load right now.</p>';
    }
  }

  if (filters) filters.addEventListener("click", event => {
    const button = event.target.closest("button[data-filter]");
    if (button) applyFilter(button.dataset.filter);
  });
  document.querySelectorAll(".category-card[data-category]").forEach(card => card.addEventListener("click", () => {
    const category = card.dataset.category;
    location.hash = "latest";
    applyFilter(category);
    document.querySelector("#latest")?.scrollIntoView({behavior:"smooth"});
  }));
  if (archive) archive.addEventListener("click", event => {
    const link = event.target.closest("a[data-month]");
    if (link) {
      event.preventDefault();
      location.hash = `archive-month=${link.dataset.month}`;
    }
  });

  const menuButton = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".nav-links");
  if (menuButton && nav) {
    menuButton.addEventListener("click", () => {
      const open = menuButton.getAttribute("aria-expanded") === "true";
      menuButton.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("open", !open);
    });
    nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
      nav.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    }));
  }

  const year = document.querySelector("#copyright-year");
  if (year) year.textContent = new Date().getFullYear();
  window.addEventListener("hashchange", handleRoute);
  loadPosts();
})();