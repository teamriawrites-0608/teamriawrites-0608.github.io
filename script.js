
const GITHUB_OWNER = "teamriawrites-0608";
const GITHUB_REPO = "teamriawrites-0608.github.io";
const GITHUB_BRANCH = "main";
const POSTS_PATH = "content/posts";

const postGrid = document.querySelector(".post-grid");
const filterRow = document.querySelector(".filter-row");
const emptyState = document.querySelector(".empty-state");

let publishedPosts = [];

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);

  if (!match) return null;

  const metadata = {};
  let currentKey = null;

  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);

    if (field) {
      currentKey = field[1];
      let value = field[2].trim();

      if (value.startsWith('"') && value.endsWith('"')) {
        try {
          value = JSON.parse(value);
        } catch {
          value = value.slice(1, -1);
        }
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }

      metadata[currentKey] = value;
    } else if (currentKey && /^\s+/.test(line)) {
      metadata[currentKey] += "\n" + line.trim();
    }
  }

  return {
    ...metadata,
    body: match[2].trim()
  };
}

function markdownToHTML(markdown = "") {
  return markdown
    .split(/\n{2,}/)
    .map(paragraph => {
      const safe = escapeHTML(paragraph.trim())
        .replace(/\n/g, "<br>");

      return safe ? `<p>${safe}</p>` : "";
    })
    .join("");
}

function formatDate(date) {
  const parsed = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return date || "";

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function renderFilters(posts) {
  if (!filterRow) return;

  const categories = [...new Set(posts.map(post => post.category).filter(Boolean))];

  filterRow.innerHTML = [
    '<button class="filter active" data-filter="All">Everything</button>',
    ...categories.map(category =>
      `<button class="filter" data-filter="${escapeHTML(category)}">${escapeHTML(category)}</button>`
    )
  ].join("");

  filterRow.addEventListener("click", event => {
    const button = event.target.closest(".filter");
    if (!button) return;

    filterRow.querySelectorAll(".filter").forEach(item =>
      item.classList.remove("active")
    );

    button.classList.add("active");

    const selected = button.dataset.filter;
    let visible = 0;

    postGrid.querySelectorAll(".post-card").forEach(card => {
      const show = selected === "All" ||
        card.dataset.category === selected;

      card.hidden = !show;
      if (show) visible++;
    });

    if (emptyState) emptyState.hidden = visible !== 0;
  }, { once: true });
}

function renderPosts(posts) {
  if (!postGrid) return;

  if (!posts.length) {
    postGrid.innerHTML = "";
    if (emptyState) {
      emptyState.hidden = false;
      emptyState.textContent = "No published notes just yet. Come back soon ♡";
    }
    return;
  }

  postGrid.innerHTML = posts.map((post, index) => {
    const image = post.cover_image
      ? `<img src="${escapeHTML(post.cover_image)}" alt="${escapeHTML(post.title)}" loading="lazy">`
      : "";

    const slug = encodeURIComponent(post.slug);

    return `
      <article class="post-card" data-category="${escapeHTML(post.category || "")}">
        <a class="post-image" href="#article=${slug}" aria-label="Read ${escapeHTML(post.title)}">
          ${image}
          <span class="image-stamp">${escapeHTML(post.category || "DIARY")}</span>
        </a>
        <p class="post-meta">${escapeHTML(post.category || "DIARY")} <span>·</span> ${formatDate(post.date)}</p>
        <h3><a href="#article=${slug}">${escapeHTML(post.title)}</a></h3>
        <p class="post-description">${escapeHTML(post.excerpt || "")}</p>
        <a class="read-more" href="#article=${slug}">Read the note <span>↗</span></a>
      </article>
    `;
  }).join("");

  if (emptyState) emptyState.hidden = true;
  renderFilters(posts);
}

function renderArticle(post) {
  let detail = document.querySelector("#article-detail");

  if (!detail) {
    detail = document.createElement("section");
    detail.id = "article-detail";
    detail.className = "wrap";
    detail.style.padding = "60px 0";
    document.querySelector("main").appendChild(detail);
  }

  detail.innerHTML = `
    <a class="text-link" href="#latest">← Back to the diary</a>
    <p class="eyebrow">${escapeHTML(post.category || "DIARY")}</p>
    <h1>${escapeHTML(post.title)}</h1>
    <p class="post-meta">${formatDate(post.date)}</p>
    ${post.cover_image
      ? `<img src="${escapeHTML(post.cover_image)}" alt="${escapeHTML(post.title)}" style="width:100%;max-height:480px;object-fit:cover;margin:24px 0">`
      : ""}
    <div class="article-body">${markdownToHTML(post.body)}</div>
  `;

  document.querySelectorAll("main > section").forEach(section => {
    section.hidden = section.id !== "article-detail";
  });

  detail.hidden = false;
  window.scrollTo(0, 0);
}

function handleArticleRoute() {
  const match = location.hash.match(/^#article=(.+)$/);

  if (!match) {
    document.querySelectorAll("main > section").forEach(section => {
      section.hidden = false;
    });

    const detail = document.querySelector("#article-detail");
    if (detail) detail.hidden = true;
    return;
  }

  const slug = decodeURIComponent(match[1]);
  const post = publishedPosts.find(item => item.slug === slug);

  if (post) renderArticle(post);
}

async function loadPosts() {
  if (!postGrid) return;

  postGrid.innerHTML = "<p>Opening the diary… ♡</p>";

  try {
    const apiURL =
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${POSTS_PATH}?ref=${GITHUB_BRANCH}`;

    const response = await fetch(apiURL);

    if (!response.ok) {
      throw new Error(`GitHub returned ${response.status}`);
    }

    const files = await response.json();

    const markdownFiles = files.filter(file =>
      file.type === "file" && file.name.endsWith(".md")
    );

    const articles = await Promise.all(
      markdownFiles.map(async file => {
        const articleResponse = await fetch(file.download_url);

        if (!articleResponse.ok) return null;

        const markdown = await articleResponse.text();
        const article = parseFrontmatter(markdown);

        if (!article) return null;

        return {
          ...article,
          slug: file.name.replace(/\.md$/, "")
        };
      })
    );

    publishedPosts = articles
      .filter(post => post && String(post.published).toLowerCase() === "true")
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    renderPosts(publishedPosts);
    handleArticleRoute();

  } catch (error) {
    console.error("RiaWrites article loading error:", error);
    postGrid.innerHTML =
      "<p>Our diary is taking a little break. Please visit again soon ♡</p>";
  }
}

// Mobile navigation
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".nav-links");

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!expanded));
    navigation.classList.toggle("open", !expanded);
  });

  navigation.querySelectorAll("a").forEach(link =>
    link.addEventListener("click", () => {
      navigation.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
    })
  );
}

// Newsletter demo
const signupForm = document.querySelector(".signup-form");

if (signupForm) {
  signupForm.addEventListener("submit", event => {
    event.preventDefault();

    const success = document.querySelector(".form-success");
    if (success) success.hidden = false;

    signupForm.reset();
  });
}

// Article navigation
window.addEventListener("hashchange", handleArticleRoute);

loadPosts();
