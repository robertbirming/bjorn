/*
 Plugin name: Björn add-ons
 Description: Copy code, gallery lightbox, latest posts, post nav dates, status, blog archive, reply link, tags at the top and footer credit in one script. The switchable ones are turned on or off in the Björn tab under Themes.
 Version: 0.9.5
 Author: Robert Birming
 Author URI: https://robertbirming.com
*/
(() => {
  "use strict";

  const VERSION = "0.9.5";
  // Where this copy was loaded from, read while it's still running
  const SELF = document.currentScript?.src || "";

  // Never write Bear's double-brace tags in this file, not even in a comment:
  // Bear fills them in wherever they appear in the footer, and breaks the script

  // Copy code, the lightbox and latest posts always run: they only act on code
  // blocks, #gallery photos and the latest posts list. The Björn tab writes the switchable ones into the
  // theme CSS, e.g. --hub-addons: archive reply credit. Not set yet means archive on.
  const ALWAYS = [copyCode, galleryLightbox, latestPosts, postNavDates, ariaCurrent, upvotePop, statusCard];
  const SWITCHED = { archive: blogArchive, reply: replyLink, credit: footerCredit, "tags-top": tagsTop };

  function run() {
    const css = getComputedStyle(document.documentElement);
    const list = css.getPropertyValue("--hub-addons").trim();
    const on = (name) => (list ? list.split(/\s+/).includes(name) : name === "archive");
    const jobs = ALWAYS.map((start) => [start.name, start]);
    for (const [name, start] of Object.entries(SWITCHED)) if (on(name)) jobs.push([name, start]);
    for (const [name, start] of jobs) {
      const fail = (error) => console.error(`Björn add-ons (${name}):`, error);
      try { Promise.resolve(start(css)).catch(fail); } catch (error) { fail(error); }
    }
  }

  // The theme says which Björn it is. Loaded from the channel (…@0/hub.js),
  // this copy can be older than that for hours, since jsDelivr is slow to
  // notice a release. Then the theme's own version is loaded instead.
  // A newer copy than the theme stays: it works with older themes
  const newer = (a, b) => {
    const x = a.split(".").map(Number);
    const y = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
  };

  function start() {
    const theme = getComputedStyle(document.documentElement).getPropertyValue("--bjorn-version").trim().replace(/^["']|["']$/g, "");
    if (/\/bjorn@\d+\/hub\.js/.test(SELF) && /^\d+\.\d+\.\d+$/.test(theme) && newer(theme, VERSION)) {
      const script = document.createElement("script");
      script.src = SELF.replace(/@\d+\/hub\.js.*$/, `@${theme}/hub.js`);
      script.onerror = run;
      document.body.append(script);
      return;
    }
    run();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }

  /* ---------- Copy code: a copy button on every code block ---------- */
  function copyCode() {
    if (!navigator.clipboard) return;

    document.querySelectorAll("main pre").forEach((pre) => {
      const wrap = document.createElement("div");
      wrap.className = "code-wrap";
      pre.before(wrap);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "copy-code";
      button.textContent = "Copy";
      wrap.append(pre, button);

      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(pre.innerText.trimEnd());
          button.textContent = "Copied";
          button.classList.add("is-copied");
        } catch {
          button.textContent = "Failed";
        }
        setTimeout(() => {
          button.textContent = "Copy";
          button.classList.remove("is-copied");
        }, 1500);
      });
    });
  }

  /* ---------- Gallery lightbox: gallery photos in a full-screen viewer ---------- */
  function galleryLightbox() {
    /* Unlinked gallery photos get a link to their full size, so they open too */
    document.querySelectorAll('main p > img[src$="#gallery"]').forEach((img) => {
      const link = document.createElement("a");
      link.href = img.src.replace(/#gallery$/, "");
      img.replaceWith(link);
      link.append(img);
    });

    /* Skip if there are no gallery photos, or no dialog support */
    const images = [...document.querySelectorAll('main a > img[src$="#gallery"]')];
    if (!images.length || !window.HTMLDialogElement) return;

    /* The lightbox, built once and reused */
    const dialog = document.createElement("dialog");
    dialog.className = "lightbox";
    dialog.autofocus = true;
    dialog.innerHTML = `
      <button class="lightbox-close" type="button" aria-label="Close">&times;</button>
      <button class="lightbox-prev" type="button" aria-label="Previous photo">&lsaquo;</button>
      <button class="lightbox-next" type="button" aria-label="Next photo">&rsaquo;</button>
      <figure>
        <img alt="">
        <figcaption aria-hidden="true"></figcaption>
      </figure>
    `;
    document.body.append(dialog);

    const [closeButton, prevButton, nextButton] = dialog.querySelectorAll("button");
    const figure = dialog.querySelector("figure");
    const photo = dialog.querySelector("img");
    const caption = dialog.querySelector("figcaption");

    let group = [];
    let current = 0;
    let opener = null;
    let start = null;

    /* Show a photo, looping around at either end, and load its neighbours ahead */
    function show(index) {
      current = (index + group.length) % group.length;
      const { src, alt } = group[current];
      photo.removeAttribute("src");
      photo.src = src;
      photo.alt = alt;
      caption.textContent = alt;
      caption.hidden = !alt;
      dialog.setAttribute("aria-label", `Photo ${current + 1} of ${group.length}`);

      const next = (current + 1) % group.length;
      const prev = (current - 1 + group.length) % group.length;
      new Set([next, prev]).forEach((i) => {
        if (i !== current) new Image().src = group[i].src;
      });
    }

    /* Each gallery is its own set, so the arrows stay within one gallery */
    const sets = new Map();

    images.forEach((img) => {
      const link = img.parentElement;
      const set = sets.get(link.parentElement) || [];
      sets.set(link.parentElement, set);
      const index = set.push({ src: link.href, alt: img.alt }) - 1;

      link.addEventListener("click", (event) => {
        /* Let modified clicks open the photo in a new tab as usual */
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();

        opener = link;
        group = set;
        start = null;
        prevButton.hidden = nextButton.hidden = set.length < 2;
        show(index);
        dialog.showModal();
      });
    });

    /* Back to the photo you opened, and clear the large image */
    dialog.addEventListener("close", () => {
      photo.removeAttribute("src");
      opener?.focus();
    });

    closeButton.addEventListener("click", () => dialog.close());
    prevButton.addEventListener("click", () => show(current - 1));
    nextButton.addEventListener("click", () => show(current + 1));

    /* Click around the photo to close, the figure fills the screen */
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target === figure) dialog.close();
    });

    /* Arrow keys move between photos. Escape closes, built into dialogs */
    dialog.addEventListener("keydown", (event) => {
      if (group.length < 2) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      show(current + (event.key === "ArrowLeft" ? -1 : 1));
    });

    /* Swipe sideways on touch screens, one finger only so pinch zoom still works */
    dialog.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      start = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true });

    dialog.addEventListener("touchend", (event) => {
      if (!start || group.length < 2) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(current + (dx < 0 ? 1 : -1));
      start = null;
    }, { passive: true });

    dialog.addEventListener("touchcancel", () => start = null, { passive: true });
  }

  /* ---------- Blog archive: posts by month, with year filter, search and pages ---------- */
  function blogArchive() {
    const PARAM_YEAR = "y";
    const PARAM_SEARCH = "s";
    const PARAM_PAGE = "p";

    const POSTS_PER_PAGE = 25;
    const SEARCH_DEBOUNCE_MS = 140;

    const ID_WRAPPER = "blog-archive";
    const ID_YEAR = "blog-archive-year";
    const ID_SEARCH = "blog-archive-search";
    const ID_PAGINATION = "blog-archive-pagination";
    const ID_PREV = "blog-archive-prev";
    const ID_NEXT = "blog-archive-next";
    const ID_INFO = "blog-archive-info";
    const ID_EMPTY = "blog-archive-empty";

    const showEl = (el) => { el.hidden = false; el.style.display = ""; };
    const hideEl = (el) => { el.hidden = true; el.style.display = "none"; };

    const normalizeText = (s) => (s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    if (!document.body.classList.contains("blog")) return;

    const main = document.querySelector("main");
    if (!main) return;

    if (main.querySelector("#" + ID_WRAPPER)) return;

    const sourceList =
      main.querySelector("ul.embedded.blog-posts") ||
      main.querySelector("ul.blog-posts");
    if (!sourceList) return;

    const rawItems = Array.from(sourceList.querySelectorAll("li"));
    if (!rawItems.length) return;

    const legacySearch = main.querySelector("#searchInput");
    if (legacySearch) legacySearch.remove();

    const tagsBlock = main.querySelector(".tags")?.closest("small");

    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

    const parseDatetime = (dt) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dt);
      return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : new Date(dt);
    };

    const readParams = () => new URLSearchParams(location.search);

    // Uses replaceState (not pushState) so filtering/searching doesn't clutter browser history
    const writeParams = (p) => {
      const url = new URL(location.href);
      url.pathname = url.pathname.endsWith("/") ? url.pathname : url.pathname + "/";
      url.search = p.toString();
      history.replaceState(null, "", url.toString());
    };

    const setDisabled = (btn, disabled) => {
      btn.disabled = !!disabled;
    };

    const groups = Object.create(null);
    const years = Object.create(null);
    const allItems = [];

    for (let i = 0; i < rawItems.length; i++) {
      const li = rawItems[i];

      li.style.display = "";

      const time = li.querySelector("time[datetime]");
      if (!time) continue;

      const dt = time.getAttribute("datetime");
      if (!dt) continue;

      const date = parseDatetime(dt);
      if (Number.isNaN(date.getTime())) continue;

      const year = String(date.getUTCFullYear());
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const monthKey = year + "-" + month;

      const label = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });

      const anchor = li.querySelector("a");
      li.dataset.blogArchiveYear = year;
      li.dataset.blogArchiveText = normalizeText((anchor?.textContent || "").trim());

      years[year] = (years[year] || 0) + 1;

      if (!groups[monthKey]) groups[monthKey] = { label, date, items: [] };
      groups[monthKey].items.push(li);

      allItems.push(li);
    }

    if (!allItems.length) return;

    const sortedMonths = Object.keys(groups).sort((a, b) => groups[b].date - groups[a].date);

    // The month heading already says month and year, so each row keeps just the day,
    // in the blog's own style (05 or 5, 5th). Counted in UTC like the headings,
    // so a late post never lands under the wrong month. datetime keeps the full date
    const format = dateFormat();
    const ordinal = (n) => ["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th";
    for (const li of allItems) {
      const time = li.querySelector("time[datetime]");
      const day = parseDatetime(time.getAttribute("datetime")).getUTCDate();
      time.textContent = (format.includes("d") ? String(day).padStart(2, "0") : String(day)) + (format.includes("S") ? ordinal(day) : "");
    }

    sourceList.remove();

    const wrapper = document.createElement("div");
    wrapper.id = ID_WRAPPER;
    main.appendChild(wrapper);

    const controls = document.createElement("p");

    const yearSelect = document.createElement("select");
    yearSelect.id = ID_YEAR;
    yearSelect.setAttribute("aria-label", "Filter posts by year");
    yearSelect.setAttribute("aria-controls", wrapper.id);

    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "All posts";
    yearSelect.appendChild(optAll);

    Object.keys(years)
      .sort((a, b) => Number(b) - Number(a))
      .forEach((y) => {
        const opt = document.createElement("option");
        opt.value = y;
        opt.textContent = y + " (" + years[y] + ")";
        yearSelect.appendChild(opt);
      });

    controls.appendChild(yearSelect);

    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.id = ID_SEARCH;
    searchInput.placeholder = "Search\u2026";
    searchInput.autocomplete = "off";
    searchInput.spellcheck = false;
    searchInput.setAttribute("aria-label", "Search posts");
    searchInput.setAttribute("aria-controls", wrapper.id);

    controls.appendChild(searchInput);

    wrapper.appendChild(controls);

    const emptyMsg = document.createElement("p");
    emptyMsg.id = ID_EMPTY;
    hideEl(emptyMsg);
    wrapper.appendChild(emptyMsg);

    const months = [];

    for (let mi = 0; mi < sortedMonths.length; mi++) {
      const key = sortedMonths[mi];
      const g = groups[key];

      const h3 = document.createElement("h3");
      h3.textContent = g.label;

      const ul = document.createElement("ul");
      ul.className = "blog-posts";

      for (let j = 0; j < g.items.length; j++) {
        showEl(g.items[j]);
        ul.appendChild(g.items[j]);
      }

      wrapper.appendChild(h3);
      wrapper.appendChild(ul);

      months.push({ h3, ul });
    }

    const pagination = document.createElement("p");
    pagination.id = ID_PAGINATION;

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.id = ID_PREV;
    prevBtn.textContent = "Previous";
    prevBtn.setAttribute("aria-controls", wrapper.id);

    const info = document.createElement("span");
    info.id = ID_INFO;
    info.setAttribute("aria-live", "polite");

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.id = ID_NEXT;
    nextBtn.textContent = "Next";
    nextBtn.setAttribute("aria-controls", wrapper.id);

    pagination.appendChild(prevBtn);
    pagination.appendChild(info);
    pagination.appendChild(nextBtn);
    wrapper.appendChild(pagination);

    // Tags at the bottom, like Bear's default
    if (tagsBlock) wrapper.appendChild(tagsBlock);

    let currentPage = 1;
    let debounceId = null;

    const clearPendingSearch = () => {
      if (debounceId) {
        window.clearTimeout(debounceId);
        debounceId = null;
      }
    };

    const getFiltered = () => {
      const yr = yearSelect.value;
      const term = normalizeText(searchInput.value.trim());

      if (!yr && !term) return allItems;

      return allItems.filter((item) => {
        if (yr && item.dataset.blogArchiveYear !== yr) return false;
        if (term && !(item.dataset.blogArchiveText || "").includes(term)) return false;
        return true;
      });
    };

    const updateEmptyMessage = () => {
      const yr = yearSelect.value;
      const term = searchInput.value.trim();
      const parts = [];
      if (yr) parts.push(yr);
      if (term) parts.push("\u201C" + term + "\u201D");
      emptyMsg.textContent = "No posts found" + (parts.length ? " for " + parts.join(", ") : "") + ".";
    };

    const renderPageItems = (pageItems, hasAnyResults) => {
      allItems.forEach(hideEl);
      pageItems.forEach(showEl);

      months.forEach(({ h3, ul }) => {
        const anyVisible = Array.from(ul.children).some((c) => !c.hidden);
        if (anyVisible) {
          showEl(ul);
          showEl(h3);
        } else {
          hideEl(ul);
          hideEl(h3);
        }
      });

      hasAnyResults ? hideEl(emptyMsg) : showEl(emptyMsg);
    };

    const syncUrl = () => {
      const yr = yearSelect.value;
      const term = searchInput.value.trim();
      const p = readParams();
      yr ? p.set(PARAM_YEAR, yr) : p.delete(PARAM_YEAR);
      term ? p.set(PARAM_SEARCH, term) : p.delete(PARAM_SEARCH);
      currentPage > 1 ? p.set(PARAM_PAGE, String(currentPage)) : p.delete(PARAM_PAGE);
      writeParams(p);
    };

    const update = () => {
      const filtered = getFiltered();
      const hasAnyResults = filtered.length > 0;
      const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE));
      currentPage = clamp(currentPage, 1, totalPages);

      const start = (currentPage - 1) * POSTS_PER_PAGE;
      renderPageItems(filtered.slice(start, start + POSTS_PER_PAGE), hasAnyResults);

      if (hasAnyResults) {
        info.textContent = "Page " + currentPage + " of " + totalPages;
        setDisabled(prevBtn, currentPage === 1);
        setDisabled(nextBtn, currentPage === totalPages);
        filtered.length <= POSTS_PER_PAGE ? hideEl(pagination) : showEl(pagination);
      } else {
        info.textContent = "";
        hideEl(pagination);
      }

      updateEmptyMessage();
      syncUrl();
    };

    const p0 = readParams();
    yearSelect.value = p0.get(PARAM_YEAR) || "";
    searchInput.value = p0.get(PARAM_SEARCH) || "";

    const page0 = parseInt(p0.get(PARAM_PAGE) || "1", 10);
    currentPage = Number.isFinite(page0) && page0 > 0 ? page0 : 1;

    const scrollToTop = () => {
      wrapper.scrollIntoView({ behavior: "smooth" });
    };

    yearSelect.addEventListener("change", () => {
      clearPendingSearch();
      currentPage = 1;
      update();
    });

    let lastHandledValue = null;

    const runSearchUpdate = () => {
      const value = searchInput.value;
      if (value === lastHandledValue) return;
      lastHandledValue = value;
      currentPage = 1;
      clearPendingSearch();
      update();
    };

    searchInput.addEventListener("input", () => {
      if (!searchInput.value.trim()) {
        runSearchUpdate();
        return;
      }
      currentPage = 1;
      clearPendingSearch();
      // Debounce while typing to avoid re-filtering on every keystroke
      debounceId = window.setTimeout(() => {
        debounceId = null;
        lastHandledValue = searchInput.value;
        update();
      }, SEARCH_DEBOUNCE_MS);
    });

    searchInput.addEventListener("search", runSearchUpdate);

    prevBtn.addEventListener("click", () => {
      if (prevBtn.disabled) return;
      currentPage -= 1;
      update();
      scrollToTop();
    });

    nextBtn.addEventListener("click", () => {
      if (nextBtn.disabled) return;
      currentPage += 1;
      update();
      scrollToTop();
    });

    update();
  
  }

  /* ---------- Latest posts: never the post you're reading ---------- */
  // Bear's posts embed in the footer can't leave out the current post,
  // so it's removed here, then the list is trimmed to three.
  // Same idea as Herman's "Hide current post from embeds" plugin, no need for both
  function latestPosts() {
    const list = document.querySelector(".latest-posts ul");
    if (!list) return;

    const trim = (path) => path.replace(/^\/+|\/+$/g, "");
    const here = trim(location.pathname);
    if (document.body.classList.contains("post") && here) {
      for (const li of [...list.children]) {
        const href = li.querySelector("a[href]")?.getAttribute("href");
        if (!href) continue;
        const url = new URL(href, location.href);
        if (url.host === location.host && trim(url.pathname) === here) li.remove();
      }
    }

    [...list.children].slice(3).forEach((li) => li.remove());
  }

  /* ---------- Post nav dates: a date under each newer and older title ---------- */
  // Bear's post nav links carry no dates, so they're looked up on the blog page.
  // One fetch, only on posts with the post nav showing. If it fails, the nav stays as it is
  function postNavDates() {
    const nav = document.querySelector(".post .post-nav");
    if (!nav || getComputedStyle(nav).display === "none") return;
    const links = [...nav.querySelectorAll("a[href]")];
    if (!links.length) return;

    const trim = (href) => new URL(href, location.href).pathname.replace(/^\/+|\/+$/g, "");
    return fetch("/blog/").then((r) => (r.ok ? r.text() : "")).then((html) => {
      if (!html) return;
      const doc = new DOMParser().parseFromString(html, "text/html");
      const dates = new Map();
      for (const li of doc.querySelectorAll("ul.blog-posts li")) {
        const a = li.querySelector("a[href]");
        const t = li.querySelector("time[datetime]");
        if (a && t) dates.set(trim(a.getAttribute("href")), t.getAttribute("datetime"));
      }
      const format = dateFormat();
      for (const link of links) {
        const datetime = dates.get(trim(link.getAttribute("href")));
        if (!datetime || link.querySelector("time")) continue;
        const time = document.createElement("time");
        time.dateTime = datetime;
        time.textContent = formatDate(datetime, format);
        link.append(time);
      }
    });
  }

  // The blog's own date format, from Bear's date script on the page
  function dateFormat() {
    for (const script of document.scripts) {
      const match = script.textContent.match(/format_string\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    }
    return "d M, Y";
  }

  // Same letters as Bear's date settings
  function formatDate(value, format) {
    const date = new Date(value);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const pad = (n) => String(n).padStart(2, "0");
    const d = date.getDate(), m = date.getMonth(), y = date.getFullYear(), h = date.getHours();
    const ordinal = (n) => ["th", "st", "nd", "rd"][(n % 100 - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th";
    const map = {
      d: () => pad(d), j: () => String(d), S: () => ordinal(d),
      m: () => pad(m + 1), M: () => months[m].slice(0, 3), F: () => months[m],
      Y: () => String(y), y: () => String(y).slice(-2),
      D: () => days[date.getDay()].slice(0, 3), l: () => days[date.getDay()],
      H: () => pad(h), h: () => pad(h % 12 || 12), g: () => String(h % 12 || 12),
      i: () => pad(date.getMinutes()), a: () => (h < 12 ? "am" : "pm"), A: () => (h < 12 ? "AM" : "PM")
    };
    return [...format].map((c) => (map[c] ? map[c]() : c)).join("");
  }

  /* ---------- Reply link: "Reply via email" at the end of each post ---------- */
  function replyLink(css) {
    const main = document.querySelector("main");
    if (!document.body.classList.contains("post") || !main || main.querySelector(".reply-link")) return;

    // An email address or a link to a contact page, set in the Björn tab
    const to = css.getPropertyValue("--hub-reply").trim().replace(/^["']|["']$/g, "");
    if (!to) return;

    const title = main.querySelector("h1")?.textContent.trim() || document.title;
    const link = document.createElement("a");
    link.textContent = "Reply via email";
    if (/^https:\/\//.test(to)) {
      // Letterbird fills in the subject from the link, like Pika does
      const letterbird = /^https:\/\/(www\.)?letterbird\.co\//.test(to) && !/[?&]subject=/.test(to);
      link.href = letterbird
        ? `${to}${to.includes("?") ? "&" : "?"}subject=${encodeURIComponent(`Re: ${title}`)}`
        : to;
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      link.href = `mailto:${to}?subject=${encodeURIComponent(`Re: ${title}`)}`;
    } else {
      return;
    }

    const p = document.createElement("p");
    p.className = "reply-link";
    p.append(link);
    // Before the tags and upvote, right after the post itself
    const anchor = main.querySelector(".tags, #upvote-form");
    const spot = anchor && [...main.children].find((el) => el.contains(anchor));
    spot ? spot.before(p) : main.append(p);
  }

  /* ---------- Tags at the top: next to the date, not after the post ---------- */
  // Bear puts tags after the post. With Top picked in the Björn tab they move up
  // beside the date, like "22 Nov 2026 · #bear #themes". If this never runs,
  // they simply stay at the bottom
  function tagsTop() {
    const tags = document.querySelector(":is(.post, .page) main > .tags");
    const links = tags ? [...tags.querySelectorAll("a")] : [];
    if (!links.length) return;

    const main = tags.parentElement;
    const date = main.querySelector(":scope > h1 + p time")?.closest("p");
    const span = document.createElement("span");
    span.className = "tags-top";
    links.forEach((link, i) => span.append(...(i ? [" ", link] : [link])));

    if (date) {
      span.prepend("· ");
      date.append(" ", span);
    } else {
      // Pages have no date: a line of their own under the title
      const p = document.createElement("p");
      p.className = "tags-top-line";
      p.append(span);
      const title = main.querySelector(":scope > h1");
      title ? title.after(p) : main.prepend(p);
    }
    tags.remove();
  }

  /* ---------- Footer credit: "Styled with Björn" above Bear's own line ---------- */
  function footerCredit() {
    const footer = document.querySelector("footer");
    if (!footer || footer.querySelector(".hub-credit")) return;

    const credit = document.createElement("span");
    credit.className = "hub-credit";
    credit.append("Styled with ");
    const link = document.createElement("a");
    link.href = "https://robertbirming.com/bjorn/";
    link.textContent = "Björn";
    credit.append(link);

    // Just above "Powered by Bear", so Bear keeps the last line. Or at the end of the footer
    const bear = [...footer.children].find((el) => el.querySelector('a[href*="bearblog.dev"]') && el.id !== "footer-directive");
    bear ? bear.before(credit) : footer.append(credit);
  }

  /* ---------- Status: the one posted from the dashboard, as a card in the footer ---------- */
  // Below whatever the footer directive holds, above the credits. Nothing set, nothing shown
  function statusCard(css) {
    const read = (name) => {
      const v = css.getPropertyValue(name).trim();
      return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
    };
    const text = read("--hub-status-text");
    const at = new Date(read("--hub-status-at"));
    const footer = document.querySelector("footer");
    if (!text || !footer || footer.querySelector(".hub-status")) return;

    const card = document.createElement("aside");
    card.className = "hub-status";
    card.setAttribute("aria-label", "Status");
    const inner = document.createElement("div");
    inner.className = "hub-status-card";

    const emoji = read("--hub-status-emoji");
    if (emoji) {
      const span = document.createElement("span");
      span.className = "hub-status-emoji";
      span.setAttribute("aria-hidden", "true");
      span.textContent = emoji;
      inner.append(span);
    }

    // [text](link) becomes a link, only for http and https addresses
    const p = document.createElement("p");
    const linkRe = /\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
    let last = 0;
    for (const m of text.matchAll(linkRe)) {
      p.append(text.slice(last, m.index));
      const a = document.createElement("a");
      a.href = m[2];
      a.textContent = m[1] || m[2];
      p.append(a);
      last = m.index + m[0].length;
    }
    p.append(text.slice(last));
    if (!Number.isNaN(at.getTime())) {
      const time = document.createElement("time");
      time.dateTime = at.toISOString();
      time.title = at.toLocaleString(document.documentElement.lang || undefined, { dateStyle: "long", timeStyle: "short" });
      time.textContent = ago(at);
      p.append(" ", time);
    }
    inner.append(p);
    card.append(inner);

    const directive = footer.querySelector(":scope > #footer-directive");
    directive ? directive.after(card) : footer.prepend(card);
  }

  // "2 days ago", in the blog's language
  function ago(date) {
    const seconds = (date.getTime() - Date.now()) / 1000;
    const steps = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(document.documentElement.lang || undefined, { numeric: "auto" });
    } catch {
      rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    }
    for (const [unit, size] of steps) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return rtf.format(0, "second");
  }

  /* ---------- Upvote pop: marks the click that toasts a post ---------- */
  // Bear disables the button both on a fresh toast and on a later visit.
  // This class tells them apart, so the heart or emoji pops only on the click
  function upvotePop() {
    const form = document.querySelector("#upvote-form");
    const button = form?.querySelector(".upvote-button");
    if (!button) return;
    // Runs after Bear's own handler, which may skip a click that came too soon
    form.addEventListener("submit", () => {
      if (button.disabled) button.classList.add("is-toasting");
    });
  }

  /* ---------- Aria current: marks the nav link for the page you're on ---------- */
  // Helps screen readers. No look of its own; style [aria-current] if you like
  function ariaCurrent() {
    const trim = (path) => path.replace(/\/+$/, "") || "/";
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    const here = trim(new URL(canonical || location.href).pathname);
    for (const link of document.querySelectorAll("header nav a[href]")) {
      const url = new URL(link.getAttribute("href"), location.href);
      if (url.host === location.host && trim(url.pathname) === here) {
        link.setAttribute("aria-current", "page");
        break;
      }
    }
  }
})();
