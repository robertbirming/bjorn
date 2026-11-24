/*
 Plugin name: Björn dashboard
 Description: A Björn tab under Themes, Status in the dashboard nav, and Format in the post editor: a small Markdown toolbar with Gallery for uploading several photos at once, and Meta image for share images. One line in your dashboard plugins.
 Version: 0.9.4
 Author: Robert Birming
 Author URI: https://robertbirming.com
*/
(() => {
  'use strict';

  // Each part checks for its own page and does nothing anywhere else
  const PARTS = [customize, format, status];

  /* ---------- Shared by the parts: Den settings, fonts and colors ---------- */
  const THEME_MARK = '/* ===== Theme ===== */';
  const SETTINGS_MARK = '/* ===== Settings ===== */';
  const ADDONS_MARK = '/* ===== Add-ons ===== */';
  const OWN_MARK = '/* ===== Your CSS ===== */';
  const ZONE_START = '\n/* ===== ';
  const STATE_RE = /\/\* hub (\{[^*]*\}) \*\//;

  /* ---------- Fonts ---------- */
  const CDN = 'https://cdn.jsdelivr.net/npm/@fontsource-variable';
  const RANGES = {
    latin: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
    'latin-ext': 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF'
  };

  // Schibsted's faces live in the theme itself. The others are added
  // to the settings only when chosen, so nobody loads a font they didn't pick.
  // scale evens out how big a font looks next to Schibsted.
  const FONTS = {
    schibsted: {
      name: 'Schibsted Grotesk',
      stack: '"Schibsted Grotesk", "Schibsted Fallback", system-ui, sans-serif'
    },
    literata: {
      name: 'Literata',
      stack: '"Literata", "Literata Fallback", Georgia, serif',
      family: 'Literata', pkg: 'literata@5.3.0', file: 'literata', weight: '200 900',
      fallback: { local: 'Georgia', size: '107.67%', ascent: '109.31%', descent: '28.61%' }
    },
    jetbrains: {
      name: 'JetBrains Mono',
      stack: '"JetBrains Mono", "JetBrains Mono Fallback", ui-monospace, monospace',
      family: 'JetBrains Mono', pkg: 'jetbrains-mono@5.3.0', file: 'jetbrains-mono', weight: '100 800',
      fallback: { local: 'Courier New', size: '99.98%', ascent: '102.02%', descent: '30%' },
      scale: 0.92
    },
    verdana: {
      name: 'Verdana',
      stack: 'Verdana, "DejaVu Sans", sans-serif',
      scale: 0.94
    },
    system: {
      name: 'System',
      stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    }
  };

  const fontFaces = (f) => {
    if (!f.family) return '';
    const faces = [];
    for (const subset of ['latin', 'latin-ext']) {
      for (const style of ['normal', 'italic']) {
        faces.push(`@font-face {
  font-family: "${f.family}";
  font-style: ${style};
  font-weight: ${f.weight};
  font-display: swap;
  src: url("${CDN}/${f.pkg}/files/${f.file}-${subset}-wght-${style}.woff2") format("woff2");
  unicode-range: ${RANGES[subset]};
}`);
      }
    }
    const fb = f.fallback;
    faces.push(`/* ${fb.local} sized to match, so text doesn't jump when the font loads */
@font-face {
  font-family: "${f.family} Fallback";
  src: local("${fb.local}");
  size-adjust: ${fb.size};
  ascent-override: ${fb.ascent};
  descent-override: ${fb.descent};
  line-gap-override: 0%;
}`);
    return faces.join('\n\n');
  };

  /* ---------- Colors ---------- */
  const PRESETS = [
    { id: 'default', name: 'Default',
      light: { bg: '#f7f7f4', text: '#1c2230', link: '#174ea3' },
      dark: { bg: '#141a22', text: '#e4e7ec', link: '#7db7f7' } },
    { id: 'sea', name: 'Sea',
      light: { bg: '#f2f6f6', text: '#1b2b30', link: '#0b6670' },
      dark: { bg: '#01242e', text: '#dde6e9', link: '#8cc2dd' } },
    { id: 'paper', name: 'Paper',
      light: { bg: '#f1e8d6', text: '#33291f', link: '#7a2a1c' },
      dark: { bg: '#1c1712', text: '#e9dcc6', link: '#d99a7a' } },
    { id: 'ink', name: 'Ink',
      light: { bg: '#fafaf9', text: '#1f1f1f', link: '#000000' },
      dark: { bg: '#131313', text: '#e4e4e4', link: '#ffffff' } }
  ];
  const KEYS = ['bg', 'text', 'link'];
  const LABELS = { bg: 'Background', text: 'Text', link: 'Links' };
  const MODES = [
    { id: 'auto', name: 'Auto', hint: 'Follows each visitor’s light or dark setting.' },
    { id: 'light', name: 'Light', hint: 'Everyone sees the light colors.' },
    { id: 'dark', name: 'Dark', hint: 'Everyone sees the dark colors.' }
  ];
  // How links are marked. None is Bear's own default: color only, underlined on hover
  const LINKS = [
    { id: 'default', name: 'Default', hint: 'Links are underlined.' },
    { id: 'subtle', name: 'Subtle', hint: 'A soft underline, full on hover.' },
    { id: 'none', name: 'None', hint: 'Links show by color, underlined on hover.' }
  ];
  // Blog list: the blog page, the archive and Latest posts. Columns is the theme's own
  const LISTS = [
    { id: 'columns', name: 'Default', hint: 'Dates in a column, titles lined up beside them.' },
    { id: 'split', name: 'Split', hint: 'Titles first, dates on the right, a soft line between posts.' },
    { id: 'stacked', name: 'Stacked', hint: 'Each title with its date underneath.' }
  ];
  // Tiny line drawings for the buttons: short bar = date, long bar = title
  const LIST_ICONS = {
    columns: '<rect x="0" y="1" width="5" height="2"/><rect x="7" y="1" width="13" height="2"/><rect x="0" y="7" width="5" height="2"/><rect x="7" y="7" width="11" height="2"/><rect x="0" y="13" width="5" height="2"/><rect x="7" y="13" width="12" height="2"/>',
    split: '<rect x="0" y="1" width="12" height="2"/><rect x="15" y="1" width="5" height="2"/><rect x="0" y="5.7" width="20" height="0.6"/><rect x="0" y="9" width="10" height="2"/><rect x="15" y="9" width="5" height="2"/>',
    stacked: '<rect x="0" y="0" width="14" height="2"/><rect x="0" y="3.5" width="6" height="1.5"/><rect x="0" y="9" width="12" height="2"/><rect x="0" y="12.5" width="6" height="1.5"/>'
  };

  // Page width. Default is the theme's 45rem
  const WIDTHS = [
    { id: 'narrow', name: 'Narrow', max: '38rem', pad: '40px', hint: 'Shorter lines, a quiet column for reading.' },
    { id: 'default', name: 'Default', max: '', pad: '22px', hint: 'A comfortable line length for most blogs.' },
    { id: 'wide', name: 'Wide', max: '52rem', pad: '10px', hint: 'More room for photos and galleries.' }
  ];
  const WIDTH_ICONS = {
    narrow: '<rect x="0.5" y="0.5" width="19" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><rect x="7" y="4" width="6" height="1.5"/><rect x="7" y="7.25" width="6" height="1.5"/><rect x="7" y="10.5" width="6" height="1.5"/>',
    default: '<rect x="0.5" y="0.5" width="19" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><rect x="5" y="4" width="10" height="1.5"/><rect x="5" y="7.25" width="10" height="1.5"/><rect x="5" y="10.5" width="10" height="1.5"/>',
    wide: '<rect x="0.5" y="0.5" width="19" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1"/><rect x="3" y="4" width="14" height="1.5"/><rect x="3" y="7.25" width="14" height="1.5"/><rect x="3" y="10.5" width="14" height="1.5"/>'
  };

  // Header: the same parts, arranged three ways. Default is the theme's own
  const HEADERS = [
    { id: 'default', name: 'Default', hint: 'Avatar beside the title, nav underneath.' },
    { id: 'centered', name: 'Centered', hint: 'Avatar, title and nav down the middle.' },
    { id: 'inline', name: 'Inline', hint: 'Title on the left, nav on the right. Phones get the default header.' }
  ];
  const HEADER_ICONS = {
    default: '<circle cx="3.5" cy="8" r="3.5"/><rect x="9" y="4.5" width="11" height="2.5"/><rect x="9" y="9.5" width="8" height="1.5"/>',
    centered: '<circle cx="10" cy="3.5" r="3.5"/><rect x="4" y="9" width="12" height="2.5"/><rect x="5.5" y="13.5" width="9" height="1.5"/>',
    inline: '<circle cx="2.5" cy="8" r="2.5"/><rect x="6.5" y="6.5" width="6" height="2.5"/><rect x="14" y="7" width="2.5" height="1.5"/><rect x="17.5" y="7" width="2.5" height="1.5"/>'
  };

  // Avatar corners. Rounded is a squircle where the browser can draw one
  const SHAPES = [
    { id: 'round', name: 'Round', radius: '50%' },
    { id: 'rounded', name: 'Rounded', radius: '30%' },
    { id: 'square', name: 'Square', radius: 'var(--radius)' }
  ];
  const SHAPE_PX = { round: 0.5, rounded: 0.3, square: 0.06 }; // share of the size, for previews and meta images
  const SIZES = [
    { id: 'small', name: 'Smaller', factor: 0.94, hint: 'A little more on screen.' },
    { id: 'default', name: 'Default', factor: 1, hint: 'Chosen for comfortable reading.' },
    { id: 'large', name: 'Larger', factor: 1.08, hint: 'A touch easier to read.' }
  ];
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '');
  const copy = (c) => ({ light: { ...c.light }, dark: { ...c.dark } });

  /* ---------- Add-ons ---------- */
  // Copy code and the lightbox are always on: they only act on code blocks
  // and #gallery photos, so your own content already decides.
  // Releases: tags in the bjorn repo, served by jsDelivr. Scripts follow the
  // channel on their own, the theme waits for Update in the Björn tab
  const REPO = 'robertbirming/bjorn';
  const CHANNEL = '0'; // 1 from launch
  const cdn = (version) => `https://cdn.jsdelivr.net/gh/${REPO}@${version}/`;
  const HUB_SCRIPT = `${cdn(CHANNEL)}hub.js`;
  const VERSION_RE = /\/\* Björn (\d+\.\d+\.\d+)/;
  const installedVersion = (css) => (css.match(VERSION_RE) || [])[1] || null;
  const newer = (a, b) => {
    const x = a.split('.').map(Number);
    const y = (b || '0.0.0').split('.').map(Number);
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
  };
  const POST_NAV = '<div class="post-nav">{{ previous_post }} {{ next_post }}</div>';
  // Four, so three are left once the add-ons script drops the post you're on
  const LATEST = '<section class="latest-posts"><h2>Latest posts</h2>{{ posts|limit:4 }}</section>';
  // Switches, in the order readers meet them. Post extras are added after each post,
  // blog extras around the rest of the blog
  const ADDONS = [
    { id: 'reply', group: 'post', name: 'Reply link', desc: 'A “Reply via email” link at the end of each post.' },
    { id: 'post', group: 'post', name: 'Post nav', desc: 'Links to the newer and older post.' },
    { id: 'latest', group: 'post', name: 'Latest posts', desc: 'A “Latest posts” list with your three newest.' },
    { id: 'archive', group: 'blog', name: 'Blog archive', desc: 'Groups blog posts by month with year filtering, search, and pagination.' },
    { id: 'status', group: 'blog', name: 'Status', desc: 'A small card in your footer, posted from Status in the dashboard nav.' },
    { id: 'credit', group: 'blog', name: 'Footer credit', desc: 'A small “Styled with Björn” line above Bear’s own credit.' }
  ];
  // Post details: Bear's own parts of each post, each with a row of choices
  const TAGS = [
    { id: 'bottom', name: 'Bottom' },
    { id: 'top', name: 'Top' },
    { id: 'hidden', name: 'Hidden' }
  ];
  const UPVOTES = [
    { id: 'bjorn', name: 'Björn', icon: '♡' },
    { id: 'bear', name: 'Bear', icon: '︽' },
    { id: 'emoji', name: 'Emoji' },
    { id: 'hidden', name: 'Hidden' }
  ];
  const EMOJI = '🧸';
  const SCRIPTED = ['archive', 'reply', 'credit'];
  const dashboardBase = location.pathname.match(/^\/[^/]+\/dashboard\//)?.[0];
  const DIRECTIVES_URL = dashboardBase ? `${dashboardBase}directives/` : null;
  const MEDIA_URL = dashboardBase ? `${dashboardBase}media/` : null;
  const ADVANCED_URL = dashboardBase ? `${dashboardBase}settings/advanced/` : null;
  const newTab = (url, text) => (url ? `<a href="${url}" target="_blank" rel="noopener">${text}</a>` : text);

  // Values that end up inside a CSS string or url(): no quotes, backslashes or line breaks
  const clean = (v) => (v || '').trim().replace(/[\\"\n\r]/g, '');
  // Text saved in the settings comment: no stars either, they could end the comment
  const plain = (v) => clean(v).replace(/\*/g, '').slice(0, 80);
  // The first emoji (or character) typed, with skin tones and joins kept whole
  // Status text: one line, and no < or > so it can never close the style tag
  const statusText = (v) => clean((v || '').replace(/"([^"\n]*)"/g, '\u201c$1\u201d').replace(/"/g, '\u201d')).replace(/[*<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 600);
  // What readers see: a [text](link) counts as its text. 140 at most
  const STATUS_MAX = 140;
  const statusLength = (v) => v.replace(/\[([^\]]*)\]\(https?:\/\/[^\s)]+\)/g, '$1').trim().length;
  const isTime = (v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?Z$/.test(v);
  const oneEmoji = (v) => {
    const t = plain(v);
    if (!t) return '';
    return window.Intl?.Segmenter ? [...new Intl.Segmenter().segment(t)][0].segment : [...t][0];
  };

  /* ---------- Reading and writing the CSS ---------- */
  const defaults = () => ({
    font: 'schibsted', size: 'default', preset: 'default', mode: 'auto', custom: copy(PRESETS[0]),
    avatar: '', avatarShape: 'round', reply: '',
    addons: { archive: true, post: true, latest: false, reply: false, status: false, credit: false },
    links: 'default', width: 'default', list: 'columns', header: 'default', tags: 'bottom', upvote: 'bjorn', upvoteEmoji: EMOJI,
    meta: { on: false, name: '', tagline: '', avatar: true },
    status: null
  });

  function readState(css) {
    const state = defaults();
    try {
      const saved = JSON.parse(css.match(STATE_RE)?.[1] || 'null');
      if (saved) {
        if (FONTS[saved.font]) state.font = saved.font;
        if (SIZES.some((z) => z.id === saved.size)) state.size = saved.size;
        if (saved.preset === 'custom' || PRESETS.some((p) => p.id === saved.preset)) state.preset = saved.preset;
        if (MODES.some((m) => m.id === saved.mode)) state.mode = saved.mode;
        if (typeof saved.avatar === 'string') state.avatar = clean(saved.avatar);
        if (SHAPES.some((a) => a.id === saved.avatarShape)) state.avatarShape = saved.avatarShape;
        if (typeof saved.reply === 'string') state.reply = clean(saved.reply);
        if (saved.meta) {
          state.meta.on = saved.meta.on === true;
          state.meta.avatar = saved.meta.avatar !== false;
          if (typeof saved.meta.name === 'string') state.meta.name = plain(saved.meta.name);
          if (typeof saved.meta.tagline === 'string') state.meta.tagline = plain(saved.meta.tagline);
        }
        for (const a of ADDONS) {
          if (typeof saved.addons?.[a.id] === 'boolean') state.addons[a.id] = saved.addons[a.id];
        }
        if (LINKS.some((l) => l.id === saved.links)) state.links = saved.links;
        if (LISTS.some((l) => l.id === saved.list)) state.list = saved.list;
        if (HEADERS.some((h) => h.id === saved.header)) state.header = saved.header;
        if (WIDTHS.some((w) => w.id === saved.width)) state.width = saved.width;
        if (TAGS.some((t) => t.id === saved.tags)) state.tags = saved.tags;
        else if (saved.addons?.tags === false) state.tags = 'hidden'; // the 0.21 switch
        if (UPVOTES.some((u) => u.id === saved.upvote)) state.upvote = saved.upvote;
        else if (saved.addons?.upvote === false) state.upvote = 'hidden'; // the 0.21 switch
        if (saved.status && isTime(saved.status.at)) {
          const text = statusText(saved.status.text);
          if (text) state.status = { emoji: oneEmoji(saved.status.emoji || ''), text, at: saved.status.at };
        }
        if (typeof saved.upvoteEmoji === 'string') state.upvoteEmoji = oneEmoji(saved.upvoteEmoji) || EMOJI;
        // Status came before its switch: keep it on for those who already posted one
        if (typeof saved.addons?.status !== 'boolean' && state.status) state.addons.status = true;
        // Related posts became Latest posts: keep it on for those who had it on
        if (typeof saved.addons?.latest !== 'boolean' && saved.addons?.related === true) state.addons.latest = true;
        for (const mode of ['light', 'dark']) {
          for (const k of KEYS) {
            const v = saved.custom?.[mode]?.[k];
            if (isHex(v)) state.custom[mode][k] = v.toLowerCase();
          }
        }
      }
    } catch { /* unreadable settings: start from the defaults */ }
    return state;
  }

  // The font's own scale times the chosen text size
  const scaleOf = (state) => {
    const factor = SIZES.find((z) => z.id === state.size)?.factor || 1;
    return Math.round((FONTS[state.font].scale || 1) * factor * 1000) / 1000;
  };

  const colorsOf = (state) =>
    state.preset === 'custom' ? state.custom : PRESETS.find((p) => p.id === state.preset) || PRESETS[0];

  /* ---------- Fonts in the dashboard, for previews and meta images ---------- */
  const fontSheet = document.createElement('style');
  const fontsIn = new Set();
  function ensureFont(id) {
    if (!fontSheet.isConnected) {
      document.head.append(fontSheet);
      // Schibsted comes with the theme, the dashboard needs its own copy
      fontSheet.textContent += fontFaces({
        family: 'Schibsted Grotesk', pkg: 'schibsted-grotesk@5.3.0', file: 'schibsted-grotesk', weight: '400 900',
        fallback: { local: 'Arial', size: '104.66%', ascent: '93.3%', descent: '24.63%' }
      }).replace(/Schibsted Grotesk Fallback/g, 'Schibsted Fallback') + '\n';
    }
    if (fontsIn.has(id) || !FONTS[id]?.family) return;
    fontsIn.add(id);
    fontSheet.textContent += fontFaces(FONTS[id]) + '\n';
  }

  /* ---------- Meta image: a 1200×630 share image from a post title ---------- */
  const META_W = 1200, META_H = 630, META_PAD_X = 84, META_PAD_Y = 76;

  const loadImage = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    // Without this the canvas couldn't be uploaded
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // skip the avatar rather than fail
    setTimeout(() => resolve(null), 8000); // or if it never answers
    img.src = src;
  });

  function fitLines(ctx, text, maxWidth, maxLines) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) { line = test; continue; }
      if (line) lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.join(' ').split(/\s+/).length < words.length) {
      let last = lines[lines.length - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.replace(/\s*\S+$/, '');
      lines[lines.length - 1] = `${last}…`;
    }
    return lines;
  }

  // Like text-wrap: balance, the narrowest width that keeps the same number of lines
  function balanced(ctx, text, maxWidth, maxLines) {
    const lines = fitLines(ctx, text, maxWidth, maxLines);
    if (lines.length < 2 || lines[lines.length - 1].endsWith('…')) return lines;
    let lo = maxWidth / lines.length, hi = maxWidth;
    while (hi - lo > 4) {
      const mid = (lo + hi) / 2;
      const test = fitLines(ctx, text, mid, maxLines);
      if (test.length === lines.length && !test[test.length - 1].endsWith('…')) hi = mid;
      else lo = mid;
    }
    return fitLines(ctx, text, hi, maxLines);
  }

  const mixColor = (a, b, t) => {
    const x = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
    const y = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(' ')})`;
  };

  // One color scheme per image: the dark one only when the blog is always dark
  async function drawMeta(state, title, canvas = document.createElement('canvas')) {
    const c = colorsOf(state)[state.mode === 'dark' ? 'dark' : 'light'];
    const font = FONTS[state.font].stack;
    ensureFont(state.font);
    const fontsReady = Promise.all(['700 76px', '600 32px', '400 26px']
      .map((f) => document.fonts?.load(`${f} ${font}`).catch(() => null)));
    const [avatar] = await Promise.all([
      state.meta.avatar && state.avatar ? loadImage(state.avatar) : null,
      fontsReady
    ]);

    canvas.width = META_W;
    canvas.height = META_H;
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, META_W, META_H);

    // The title, at the top
    ctx.fillStyle = c.text;
    ctx.font = `700 76px ${font}`;
    balanced(ctx, title || 'Untitled', META_W - META_PAD_X * 2, 3)
      .forEach((line, i) => ctx.fillText(line, META_PAD_X, META_PAD_Y + 132 + i * 86));

    // Avatar, name and tagline, at the bottom
    const size = 80;
    const top = META_H - META_PAD_Y - size;
    let x = META_PAD_X;
    if (avatar) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, top, size, size, size * (SHAPE_PX[state.avatarShape] ?? 0.5));
      ctx.clip();
      const s = Math.min(avatar.width, avatar.height);
      ctx.drawImage(avatar, (avatar.width - s) / 2, (avatar.height - s) / 2, s, s, x, top, size, size);
      ctx.restore();
      x += size + 22;
    }
    const room = META_W - META_PAD_X - x;
    const { name, tagline } = state.meta;
    ctx.fillStyle = c.text;
    ctx.font = `600 32px ${font}`;
    if (name && tagline) {
      ctx.fillText(fitLines(ctx, name, room, 1)[0], x, top + 36);
      ctx.fillStyle = mixColor(c.text, c.bg, 0.65);
      ctx.font = `400 26px ${font}`;
      ctx.fillText(fitLines(ctx, tagline, room, 1)[0], x, top + 70);
    } else if (name || tagline) {
      ctx.fillText(fitLines(ctx, name || tagline, room, 1)[0], x, top + 52);
    }
    return canvas;
  }


  function run() {
    for (const part of PARTS) {
      try { part(); } catch (error) { console.error(`Björn dashboard (${part.name}):`, error); }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  /* ---------- Releases: install and update ---------- */
  // The newest release on the channel. GitHub knows the moment a release is
  // published, jsDelivr's lookup can lag behind, so it's only the fallback.
  // Checked at most every ten minutes
  async function latestRelease() {
    try {
      const saved = JSON.parse(sessionStorage.getItem('hub-latest') || 'null');
      if (saved && Date.now() - saved.at < 600e3) return saved.version;
    } catch {}
    const valid = (v) => /^\d+\.\d+\.\d+$/.test(v || '') && v.split('.')[0] === CHANNEL;
    let version = null;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.ok) version = String((await res.json()).tag_name || '').replace(/^v/, '');
    } catch {}
    if (!valid(version)) {
      const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${REPO}/resolved?specifier=${CHANNEL}`);
      if (!res.ok) throw new Error(`Release check: ${res.status}`);
      version = (await res.json()).version;
    }
    if (!valid(version)) throw new Error('No release yet');
    try { sessionStorage.setItem('hub-latest', JSON.stringify({ version, at: Date.now() })); } catch {}
    return version;
  }

  // Both theme files of a release, checked before anything is written
  async function fetchRelease(version) {
    const get = async (file) => {
      const res = await fetch(cdn(version) + file);
      if (!res.ok) throw new Error(`${file}: ${res.status}`);
      return (await res.text()).trim();
    };
    const [theme, addons] = await Promise.all([get('theme.css'), get('addons.css')]);
    if (!theme.startsWith(THEME_MARK) || installedVersion(theme) !== version || !addons.startsWith(ADDONS_MARK)) {
      throw new Error('Unexpected release files');
    }
    // "New: …" in the theme's opening comment, shown beside Update
    const notes = (theme.slice(0, theme.indexOf('*/', theme.indexOf('/* Björn '))).match(/^\s*New: (.+)$/m) || [])[1] || '';
    return { version, theme, addons, notes };
  }

  // Swaps one zone for a new copy, or adds it before Your CSS
  function replaceZone(css, mark, text) {
    const z = zone(css, mark);
    if (z) {
      const rest = css.slice(z.end);
      return rest ? `${css.slice(0, z.at)}${text}\n\n\n${rest}` : `${css.slice(0, z.at)}${text}\n`;
    }
    const own = css.indexOf(OWN_MARK);
    if (own === -1) return `${css.trimEnd()}\n\n\n${text}\n`;
    return `${css.slice(0, own).trimEnd()}\n\n\n${text}\n\n\n${css.slice(own)}`;
  }

  // Theme and Add-ons from the release. Settings and Your CSS stay as they are
  const updateCss = (css, rel) => replaceZone(replaceZone(css, THEME_MARK, rel.theme), ADDONS_MARK, rel.addons);

  // A fresh install. Whatever was there before is kept at the end,
  // turned off inside a comment, so nothing is lost
  function installCss(old, rel) {
    let css = writeSettings(`${rel.theme}\n\n\n${rel.addons}\n`, settingsBlock(defaults()));
    old = old.trim();
    css = `${css.trimEnd()}\n\n\n${OWN_MARK}\n`;
    if (old) {
      css += `\n/* Your CSS from before Björn, kept here and turned off.\n   Copy back what you want to keep, then delete this note.\n\n${old.replace(/\*\//g, '*\\/')}\n*/\n`;
    }
    return css;
  }

  // Bear's own preview of the blog, in a new tab, with Björn's CSS swapped in.
  // The tab is opened first, so browsers don't block it, then filled in
  async function previewBjorn() {
    const fallback = 'https://robertbirming.com/';
    const win = window.open(`${dashboardBase}styles/?stylesheet=bear-default&preview=true`, '_blank');
    if (!win) { window.open(fallback, '_blank'); return; }
    try {
      const css = installCss('', await fetchRelease(await latestRelease()));
      const started = Date.now();
      const fill = () => {
        let doc;
        try { doc = win.document; } catch { return; }
        const style = doc?.readyState !== 'loading' && win.location.search.includes('preview') && doc.querySelector('style[data-name="default"]');
        if (!style) {
          if (Date.now() - started < 15000 && !win.closed) setTimeout(fill, 150);
          return;
        }
        style.textContent = css;
        // The add-ons too, for the archive, copy code and the rest
        const script = doc.createElement('script');
        script.src = HUB_SCRIPT;
        doc.body.append(script);
      };
      fill();
    } catch (error) {
      console.error('Björn dashboard (preview):', error);
      if (!win.closed) win.location = fallback;
    }
  }

  /* ---------- The Settings zone: shared by the Björn tab and Status ---------- */
  // The zone from its marker up to the next zone, or the end
  function zone(css, mark) {
    const at = css.indexOf(mark);
    if (at === -1) return null;
    const next = css.indexOf(ZONE_START, at + mark.length);
    return { at, end: next === -1 ? css.length : next + 1 };
  }

  function settingsBlock(state) {
    const f = FONTS[state.font];
    const c = colorsOf(state);
    const vars = (mode, indent) => KEYS.map((k) => `${indent}--${k}: ${c[mode][k]};`).join('\n');
    const saved = {
      font: state.font, size: state.size, preset: state.preset, mode: state.mode, custom: state.custom, links: state.links, width: state.width, list: state.list, header: state.header,
      avatar: state.avatar, avatarShape: state.avatarShape, reply: state.reply, addons: state.addons, tags: state.tags, upvote: state.upvote, upvoteEmoji: state.upvoteEmoji, meta: state.meta
    };
    if (state.status) saved.status = state.status;
    const on = SCRIPTED.filter((id) => state.addons[id] && (id !== 'reply' || state.reply));
    if (state.tags === 'top') on.push('tags-top');
    const lines = [`  --font: ${f.stack};`];
    const scale = scaleOf(state);
    if (scale !== 1) lines.push(`  --scale: ${scale};`);
    lines.push(`  --hub-addons: ${on.join(' ') || 'none'};`);
    if (state.reply) lines.push(`  --hub-reply: "${state.reply}";`);
    // Off keeps the status saved, so turning it back on brings it back
    if (state.status && state.addons.status) {
      if (state.status.emoji) lines.push(`  --hub-status-emoji: "${state.status.emoji}";`);
      lines.push(`  --hub-status-text: "${state.status.text}";`);
      lines.push(`  --hub-status-at: "${state.status.at}";`);
    }

    const parts = [
      SETTINGS_MARK,
      '/* Written by the Björn tab under Themes. Changes made here are replaced. */',
      `/* hub ${JSON.stringify(saved)} */`
    ];
    const faces = fontFaces(f);
    if (faces) parts.push('', faces);

    if (state.mode === 'auto') {
      parts.push('', `:root {
${lines.join('\n')}
${vars('light', '  ')}
}

@media (prefers-color-scheme: dark) {
  :root {
${vars('dark', '    ')}
  }
}`);
    } else if (state.mode === 'light') {
      parts.push('', `/* Always light */
:root {
  color-scheme: light;
${lines.join('\n')}
${vars('light', '  ')}
}

@media (prefers-color-scheme: dark) {
  :root {
${vars('light', '    ')}
  }

  img {
    --dim: 1;
  }
}`);
    } else {
      parts.push('', `/* Always dark */
:root {
  color-scheme: dark;
${lines.join('\n')}
${vars('dark', '  ')}
}

img {
  --dim: 0.9;
  filter: brightness(var(--dim));
}`);
    }

    // :where keeps these at zero specificity, so tags, the title and other
    // links that already drop the underline keep their own look
    if (state.links === 'subtle') parts.push('', `/* Links: a soft underline, full on hover */
:where(a),
.post-nav a::after {
  text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
}

@media (hover: hover) {
  :where(a):hover,
  .post-nav a:hover::after {
    text-decoration-color: currentColor;
  }
}`);

    if (state.links === 'none') parts.push('', `/* Links: color only, underlined on hover, like Bear's default */
:where(a),
.post-nav a::after {
  text-decoration-line: none;
}

@media (hover: hover) {
  :where(a):hover,
  .post-nav a:hover::after {
    text-decoration-line: underline;
  }
}`);

    // Screen only, so print keeps the theme's full-width page
    const width = WIDTHS.find((w) => w.id === state.width);
    if (width.max) parts.push('', `/* Page width: ${width.name.toLowerCase()} */
@media screen {
  body {
    max-width: ${width.max};
  }
}`);

    // The theme's list is a grid, shared by the archive so titles line up across months
    if (state.list === 'split') parts.push('', `/* Blog list: split, titles first and dates on the right */
:is(.blog-posts, #blog-archive) {
  grid-template-columns: 1fr auto;
}

.blog-posts {
  row-gap: 0;
}

.blog-posts li {
  padding-block: 0.5em;
}

/* Dividers between posts only, so lists never end on a double line */
.blog-posts li + li {
  border-block-start: var(--line);
}

.blog-posts li > a {
  grid-column: 1;
  grid-row: 1;
}

.blog-posts li > span {
  grid-column: 2;
  grid-row: 1;
  justify-self: end;
}`);

    if (state.list === 'stacked') parts.push('', `/* Blog list: stacked, each title with its date underneath */
:is(.blog-posts, #blog-archive) {
  grid-template-columns: 1fr;
}

.blog-posts {
  row-gap: 0.75lh;
}

.blog-posts li {
  row-gap: 0.1em;
}

.blog-posts li > a {
  grid-row: 1;
}

.blog-posts li > span {
  grid-row: 2;
}`);

    if (state.avatar) parts.push('', `/* Avatar beside the title and nav. Set --avatar-radius in Your CSS for another shape */
:root {
  --avatar-size: 4rem;
  --avatar-radius: ${SHAPES.find((a) => a.id === state.avatarShape).radius};
}

header {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  column-gap: 1rem;
}

header::before {
  content: "";
  grid-row: 1 / span 2;
  width: var(--avatar-size);
  aspect-ratio: 1;
  background: url("${state.avatar}") center / cover no-repeat;
  border-radius: var(--avatar-radius);${state.avatarShape === 'rounded' ? '\n    corner-shape: squircle;' : ''}
}

header > * {
  grid-column: 2;
}

/* A little smaller on phones, so the nav keeps its room */
@media (max-width: 30rem) {
  :root {
    --avatar-size: 3.25rem;
  }

  header {
    column-gap: 0.75rem;
  }
}`);

    if (!state.addons.post) parts.push('', `/* Post nav is off */
.post-nav {
  display: none !important;
}`);

    // After the avatar block, which sets the header grid
    if (state.header === 'centered') parts.push('', `/* Header: centered, avatar, title and nav down the middle */
header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

header > * {
  grid-column: auto;
}

/* Room under the avatar only. Title and nav keep the theme's own close spacing */
header::before {
  margin-block-end: 1rem;
}

header nav p {
  justify-content: center;
}`);

    if (state.header === 'inline') parts.push('', `/* Header: inline, title on the left and nav on the right.
   Phones keep the default header, which already fits them */
@media (min-width: 40rem) {
  header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3em 0.75rem;
    --avatar-size: 2.25rem;
  }

  header > * {
    grid-column: auto;
  }

  /* A slimmer bar: title a step smaller, so it sits closer to the nav */
  header .title h1 {
    font-size: 1.25em;
  }

  header nav {
    margin-inline-start: auto;
  }

  header nav p {
    margin: 0;
  }
}`);

    // Moved up by the add-ons script, as small links matching the date
    if (state.tags === 'top') parts.push('', `/* Tags at the top, next to the date */
.tags-top {
  font-family: var(--mono);
  font-size: var(--small);
  color: var(--muted);
}

.tags-top :is(a, a:visited) {
  color: inherit;
  text-decoration: none;
}

@media (hover: hover) {
  .tags-top a:hover {
    color: var(--text);
    text-decoration: underline;
  }
}`);

    if (state.tags === 'hidden') parts.push('', `/* Tags are hidden on posts and pages. The blog page keeps its list */
:is(.post, .page) main > .tags {
  display: none !important;
}`);

    if (state.upvote === 'hidden') parts.push('', `/* Upvote button is hidden */
#upvote-form {
  display: none !important;
}`);

    // Björn and Emoji share the row layout. Bear's own button is left as Bear made it
    if (state.upvote === 'bjorn' || state.upvote === 'emoji') parts.push('', `/* Upvote button: ${state.upvote === 'bjorn' ? 'Björn’s heart, filled once toasted' : 'an emoji, faded once toasted'} */
#upvote-form .upvote-button {
  flex-direction: row;
  align-items: center;
  gap: 0.3em;
  padding: 0.25em;
  margin: -0.25em;
  font-size: var(--size);
  line-height: 1;
  color: ${state.upvote === 'bjorn' ? 'var(--link)' : 'var(--muted)'};
  border-radius: var(--radius);
}

#upvote-form svg {
  display: none;
}

#upvote-form .upvote-count {
  margin: 0;
  font-size: var(--small);
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}

/* !important beats the salmon Bear's script sets inline */
#upvote-form .upvote-button:disabled {
  color: ${state.upvote === 'bjorn' ? 'var(--link)' : 'var(--muted)'} !important;
  cursor: default;
}`);

    if (state.upvote === 'bjorn') parts.push('', `#upvote-form .upvote-button {
  --heart: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linejoin='round'%3E%3Cpath d='M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'/%3E%3C/svg%3E");
  --heart-filled: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='black' stroke='black' stroke-width='2' stroke-linejoin='round'%3E%3Cpath d='M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'/%3E%3C/svg%3E");
}

#upvote-form .upvote-button::before {
  content: "";
  display: block;
  width: 1.25em;
  aspect-ratio: 1;
  background-color: currentColor;
  mask: var(--heart) center / contain no-repeat;
}

#upvote-form .upvote-button:disabled {
  --heart: var(--heart-filled);
}`);

    // Resets the heart's mask and sizing, in case a theme draws one.
    // Full color to press, faded once toasted
    if (state.upvote === 'emoji') parts.push('', `#upvote-form .upvote-button::before {
  content: "${state.upvoteEmoji}";
  display: inline-block;
  width: auto;
  aspect-ratio: auto;
  background: none;
  mask: none;
  font-size: 1.25em;
  line-height: 1;
}

#upvote-form .upvote-button:disabled::before {
  opacity: 0.6;
}`);

    // Both grow a little on hover, and pop once on the click itself.
    // The add-ons script marks that click, so a toast from an earlier visit stays still
    if (state.upvote === 'bjorn' || state.upvote === 'emoji') parts.push('', `#upvote-form .upvote-button::before {
  transition: scale var(--transition), opacity var(--transition);
}

@media (hover: hover) {
  #upvote-form .upvote-button:not(:disabled):hover::before {
    scale: 1.15;
  }
}

#upvote-form .upvote-button.is-toasting::before {
  animation: upvote-pop 300ms ease-out;
}

@keyframes upvote-pop {
  50% { scale: 1.3; }
}`);

    if (!state.addons.latest) parts.push('', `/* Latest posts is off */
.latest-posts {
  display: none !important;
}`);
    return parts.join('\n');
  }

  // The settings sit right after the theme's own zone, so they win over it,
  // and anything after them (add-ons, your own CSS) still wins over both
  function writeSettings(css, block) {
    const z = zone(css, SETTINGS_MARK);
    if (z) {
      const rest = css.slice(z.end);
      return rest ? `${css.slice(0, z.at)}${block}\n\n\n${rest}` : `${css.slice(0, z.at)}${block}\n`;
    }
    const theme = css.indexOf(THEME_MARK);
    const next = css.indexOf(ZONE_START, theme + THEME_MARK.length);
    return next === -1
      ? `${css.trimEnd()}\n\n\n${block}\n`
      : `${css.slice(0, next).trimEnd()}\n\n\n${block}\n\n\n${css.slice(next + 1)}`;
  }


  /* ---------- The Björn tab: a third tab under Themes ---------- */
  function customize() {
    const form = document.getElementById('styles-form');
    const textarea = form?.querySelector('textarea[name="custom_styles"]');
    const tabCss = document.getElementById('tab-css');
    const tabs = document.querySelector('nav.tabs');
    if (!form || !textarea || !tabCss || !tabs || document.getElementById('tab-hub')) return;

    const readOwn = (css) => {
      const z = zone(css, OWN_MARK);
      return z ? css.slice(z.at + OWN_MARK.length, z.end).trim() : '';
    };

    // Your CSS always sits last, so it wins over everything else
    function writeOwn(css, text) {
      const z = zone(css, OWN_MARK);
      if (z) css = (css.slice(0, z.at) + css.slice(z.end)).trimEnd() + '\n';
      text = text.trim();
      return text ? `${css.trimEnd()}\n\n\n${OWN_MARK}\n\n${text}\n` : css;
    }

    /* ---------- Styles ---------- */
    const style = document.createElement('style');
    style.textContent = `
  #hub-panel{display:none}
  #tab-hub:checked ~ #hub-panel{display:block}
  #tab-hub:checked ~ #themes-tab{display:none}
  #tab-hub:checked ~ #styles-form{height:0;overflow:hidden;visibility:hidden}
  #tab-hub:checked ~ .tabs [for="tab-hub"]{color:var(--heading-color);font-weight:bold}
  #tab-hub:focus-visible ~ .tabs [for="tab-hub"]{text-decoration:underline}
  #hub-panel .hub-note[hidden],#hub-panel .hub-update[hidden]{display:none}
  #hub-panel .hub-update{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.5rem 1rem}
  #hub-panel .hub-update button{margin:0}
  .hub-install{margin:1.5rem 0}
  .hub-install-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem}
  .hub-install-actions button{margin:0}
  .hub-install-say{font-size:small;color:var(--muted)}
  .hub-current{margin-left:.4em;padding:1px 6px;font-size:small;font-weight:normal;color:var(--muted);border:1px solid var(--border);border-radius:3px;vertical-align:middle}
  .hub-current[hidden],.hub-theme-row [hidden]{display:none}
  #hub-panel .hub-note{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:.5rem 1rem}
  #hub-panel section{padding:1.5rem 0 .5rem}
  #hub-panel .hub-divider{margin:1.5rem 0 0;border:0;border-top:1px solid var(--border)}
  #hub-panel h2{margin:0 0 .75rem;font-size:1.15em}
  .hub-hint{margin:.6rem 0 0;font-size:.9em;color:var(--muted)}
  .hub-choices{display:flex;flex-wrap:wrap;gap:8px}
  .hub-choices + .hub-choices{margin-top:12px}
  #hub-panel .hub-choices button{display:flex;align-items:center;gap:8px;margin:0;padding:8px 12px;font-size:14px;background:none;color:inherit;border:1px solid var(--border);border-radius:3px}
  #hub-panel .hub-choices button:hover{border-color:var(--muted);background:none}
  #hub-panel .hub-fonts button{font-size:16px;padding:6px 14px}
  #hub-panel .hub-choices button[aria-pressed="true"]{border-color:var(--link-color);box-shadow:inset 0 0 0 1px var(--link-color);color:var(--heading-color)}
  .hub-dots{display:flex;gap:3px}
  .hub-shapes{margin-top:12px}
  .hub-list-icon{width:20px;height:16px;margin-inline-end:8px;vertical-align:-3px;fill:currentColor;opacity:.75}
  .hub-shape{display:inline-block;width:14px;height:14px;margin-inline-end:6px;vertical-align:-2px;background:currentColor;opacity:.75}
  .hub-shape-round{border-radius:50%}
  .hub-shape-rounded{border-radius:30%;corner-shape:squircle}
  .hub-shape-square{border-radius:1px}
  .hub-page .av.rounded{border-radius:30%;corner-shape:squircle}
  .hub-page .av.square{border-radius:4px}
  .hub-dots span{width:14px;height:14px;border-radius:50%;box-shadow:0 0 0 1px var(--border)}
  .hub-custom{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(14rem,100%),1fr));gap:1rem 2rem;margin-top:1rem;padding:1rem;background:var(--surface);border-radius:var(--radius)}
  .hub-custom[hidden],.hub-custom fieldset[hidden]{display:none}
  .hub-custom fieldset{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:.5rem}
  .hub-custom legend{font-weight:bold;padding:0;margin-bottom:.25rem}
  .hub-custom label{display:flex;justify-content:space-between;align-items:center;gap:1rem;font-weight:normal;font-size:.9em}
  #hub-panel .hub-custom input[type="color"]{width:44px;height:28px;padding:0;background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer}
  .hub-custom p{grid-column:1/-1;margin:0;font-size:small;color:var(--muted)}
  .hub-field{display:flex;flex-direction:column;gap:.4rem;max-width:32rem}
  .hub-field label{font-weight:normal;font-size:.9em}
  #hub-panel .hub-field input{width:100%;box-sizing:border-box;margin:0;padding:8px 10px;font-size:15px;border:1px solid var(--border);border-radius:3px}
  .hub-previews{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(16rem,100%),1fr));gap:1rem}
  .hub-previews figure{margin:0}
  .hub-previews figcaption{font-size:small;color:var(--muted);margin-bottom:.4rem}
  .hub-page{padding:20px 22px 14px;border-radius:3px;box-shadow:0 0 0 1px var(--border);line-height:1.6;font-size:14px}
  .hub-page :is(b,strong){color:inherit}
  .hub-page .hd{display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:.9em}
  .hub-page .hd > *{grid-column:2}
  .hub-page .h-centered{display:flex;flex-direction:column;align-items:center;text-align:center}
  .hub-page .h-centered .av{margin-bottom:.7em}
  .hub-page .h-centered .n{justify-content:center}
  .hub-page .h-inline{display:flex;flex-wrap:wrap;align-items:center;gap:.3em .8em}
  .hub-page .h-inline .av{width:2em}
  .hub-page .h-inline .t{font-size:1.1em}
  .hub-page .h-inline .n{margin:0 0 0 auto}
  .hub-page .t{font-weight:700;font-size:1.3em;line-height:1.2}
  .hub-page .av{grid-column:1;grid-row:1/span 2;width:3.6em;aspect-ratio:1;border-radius:50%;background:center/cover no-repeat}
  .hub-page .a{text-decoration:underline;text-underline-offset:.15em}
  .hub-page.subtle .a{text-decoration-color:color-mix(in srgb,currentColor 40%,transparent)}
  .hub-page.none .a{text-decoration:none}
  .hub-links span{text-decoration:underline;text-underline-offset:.15em}
  .hub-links .hub-link-subtle{text-decoration-color:color-mix(in srgb,currentColor 40%,transparent)}
  .hub-links .hub-link-none{text-decoration:none}
  .hub-page .n{display:flex;gap:.8em;margin-top:.2em;font-size:.95em}
  .hub-page p{margin:1em 0 .8em}
  .hub-page .q{padding:.6em 1em;border-radius:4px;font-size:.95em}
  .hub-page .l{display:grid;grid-template-columns:auto 1fr;gap:.3em .9em;margin-top:1em;align-items:baseline}
  .hub-page .l .r{display:contents}
  .hub-page .l.split{display:block}
  .hub-page .l.split .r{display:flex;justify-content:space-between;gap:.9em;padding:.35em 0}
  .hub-page .l.split .r+.r{border-top:1px solid var(--b)}
  .hub-page .l.split .d{order:2}
  .hub-page .l.stacked{display:grid;grid-template-columns:1fr;gap:.6em}
  .hub-page .l.stacked .r{display:flex;flex-direction:column;gap:.1em}
  .hub-page .l.stacked .d{order:2}
  .hub-page .d{font-family:ui-monospace,Menlo,monospace;font-size:.82em}
  .hub-page .f{margin-top:1.2em;padding-top:.6em;font-size:.82em}
  .hub-addon{display:flex;gap:14px;align-items:flex-start;padding:12px 0;border-top:1px solid var(--border)}
  #hub-panel input.hub-switch{appearance:none;-webkit-appearance:none;flex-shrink:0;width:38px;height:22px;margin:2px 0 0;padding:0;border:0;border-radius:11px;background:color-mix(in srgb,var(--text-color) 25%,transparent);position:relative;cursor:pointer;transition:background .15s}
  #hub-panel input.hub-switch::before{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--background-color);transition:transform .15s}
  #hub-panel input.hub-switch:checked{background:var(--link-color)}
  #hub-panel input.hub-switch:checked::before{transform:translateX(16px)}
  #hub-panel input.hub-switch:focus-visible{outline:2px solid var(--link-color);outline-offset:2px}
  .hub-addon > div{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
  .hub-addon label{display:flex;flex-direction:column;gap:2px;font-weight:normal;cursor:pointer}
  .hub-addon b{color:var(--heading-color)}
  .hub-addon label span{font-size:.9em;color:var(--muted)}
  .hub-addon .hub-field{margin-top:.6rem}
  .hub-addon .hub-field[hidden]{display:none}
  .hub-intro{margin:0 0 .75rem;font-size:.9em;color:var(--muted)}
  .hub-choice-row > div{display:flex;flex-direction:column;gap:.5rem}
  .hub-choice-row + .hub-choice-row{margin-top:1.5rem}
  .hub-choice-row b{color:var(--heading-color)}
  .hub-choice-row .hub-hint{margin:0}
  .hub-choice-row .hub-field{margin:0}
  .hub-emoji-field[hidden]{display:none}
  #hub-panel .hub-emoji-field input{max-width:8rem;font-size:18px}
  #hub-panel .hub-footer{margin-top:.75rem;font-size:.9em}
  .hub-footer-head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;margin-bottom:.5rem}
  #hub-panel .hub-footer button{margin:0}
  .hub-footer pre{margin:0;padding:10px 12px;background:var(--code-background-color);color:var(--code-color);border-radius:3px;font:13px/1.6 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
  #hub-panel .hub-meta .hub-addon{padding-top:0;border-top:0}
  .hub-meta-fields{display:flex;flex-direction:column;gap:.75rem;margin-top:.9rem}
  .hub-meta-fields[hidden],.hub-meta-check[hidden]{display:none}
  #hub-panel label.hub-meta-check{display:flex;flex-direction:row;align-items:center;gap:.5rem;font-weight:normal;font-size:.9em}
  #hub-panel .hub-meta-check input{width:auto;height:auto;margin:0}
  .hub-meta-fields .hub-hint{margin:0}
  .hub-meta-preview{display:block;width:100%;max-width:30rem;height:auto;border-radius:3px;box-shadow:0 0 0 1px var(--border)}
  .hub-own{margin:1.5rem 0 2rem;border-top:1px solid var(--border);padding-top:1rem}
  .hub-own summary{cursor:pointer;font-weight:bold;color:var(--heading-color)}
  .hub-own p{margin:.6rem 0;font-size:.9em;color:var(--muted)}
  #hub-panel .hub-own textarea{width:100%;box-sizing:border-box;min-height:14rem;margin:0;font:13px/1.6 ui-monospace,Menlo,Consolas,monospace;tab-size:2}
  .hub-missing{margin:1.5rem 0}
  .hub-credit{margin:0 0 1rem;padding-top:1em;border-top:1px solid var(--border);font-size:small;color:var(--muted)}`;
    document.head.append(style);

    /* ---------- The tab and the panel ---------- */
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'tab';
    radio.id = 'tab-hub';
    radio.className = 'tab-toggle';
    tabCss.after(radio);

    const label = document.createElement('label');
    label.htmlFor = 'tab-hub';
    label.textContent = 'Björn';
    tabs.append(' ', label);

    const panel = document.createElement('div');
    panel.id = 'hub-panel';
    form.after(panel);

    // Back on this tab after Publish reloads the page
    form.addEventListener('submit', () => {
      try { if (radio.checked) sessionStorage.setItem('hub-tab', '1'); } catch {}
      rememberStatus(readState(textarea.value).addons.status);
    });
    try {
      if (sessionStorage.getItem('hub-tab')) {
        sessionStorage.removeItem('hub-tab');
        radio.checked = true;
      }
    } catch {}

    let original = textarea.value;
    const NOTE = 'You have unpublished changes. Press <b>Publish</b> to put them on your blog.';

    /* ---------- A Björn card first in Bear's theme list ---------- */
    const list = document.querySelector('#themes-tab .theme-list');
    const card = document.createElement('li');
    card.className = 'theme-row hub-theme-row';
    card.innerHTML = `
    <img class="theme-thumbnail" src="${cdn(CHANNEL)}preview.png" alt="" width="900" height="600" loading="lazy">
    <div class="theme-info">
      <h2>Björn <span class="hub-current" hidden>Current</span></h2>
      <div class="theme-actions">
        <a href="#" data-act="preview" aria-label="Preview Björn on your blog (opens in a new tab)">Preview <span aria-hidden="true">↗</span></a>
        <button type="button" data-act="open"></button>
      </div>
    </div>`;
    list?.prepend(card);
    card.querySelector('[data-act="preview"]').addEventListener('click', (e) => { e.preventDefault(); previewBjorn(); });
    card.querySelector('[data-act="open"]').addEventListener('click', () => {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      tabs.scrollIntoView({ block: 'start' });
    });
    // Installed means published: what's on the blog now
    function syncCard() {
      const on = original.includes(THEME_MARK);
      card.querySelector('.hub-current').hidden = !on;
      card.querySelector('[data-act="preview"]').hidden = on;
      card.querySelector('[data-act="open"]').textContent = on ? 'Settings' : 'Install';
    }
    syncCard();

    if (original.includes(THEME_MARK)) settingsView();
    else installView();

    /* ---------- Install: on a blog without Björn ---------- */
    function installView() {
      panel.innerHTML = `
  <section class="hub-install">
    <h2>Install Björn</h2>
    <p>Björn isn’t on your blog yet. Install adds it here, ready for you to look over before you publish.</p>
    <p class="hub-hint">Your current CSS is kept under Your CSS, turned off, so nothing is lost. Until you publish, Revert puts everything back.</p>
    <p class="hub-install-actions"><button type="button" data-act="install">Install Björn</button><a href="#" data-act="preview">Preview on your blog <span aria-hidden="true">↗</span></a><span class="hub-install-say" aria-live="polite"></span></p>
  </section>`;
      const button = panel.querySelector('[data-act="install"]');
      const say = panel.querySelector('.hub-install-say');
      panel.querySelector('[data-act="preview"]').addEventListener('click', (e) => { e.preventDefault(); previewBjorn(); });
      button.addEventListener('click', async () => {
        button.disabled = true;
        say.textContent = 'Getting Björn…';
        try {
          const rel = await fetchRelease(await latestRelease());
          textarea.value = installCss(textarea.value, rel);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          settingsView(`Björn ${rel.version} is installed. Press <b>Publish</b> to put it on your blog, or Revert to undo.`);
        } catch (error) {
          console.error('Björn dashboard (install):', error);
          say.textContent = 'Couldn’t get Björn right now. Try again in a moment.';
          button.disabled = false;
        }
      });
    }

    /* ---------- Settings: on a blog with Björn ---------- */
    function settingsView(installed) {
    let state = readState(textarea.value);

    // A status posted from this page: it's already published, so it joins
    // both what's on screen and what counts as published
    document.addEventListener('hub:status', (e) => {
      state.status = e.detail.status;
      original = e.detail.css;
      apply();
    });

    const addonHTML = (a) => `<div class="hub-addon"><input type="checkbox" class="hub-switch" id="hub-addon-${a.id}" data-addon="${a.id}"><div><label for="hub-addon-${a.id}"><b>${a.name}</b><span>${a.desc}</span></label>${a.id === 'reply' ? `<div class="hub-field" hidden><input type="text" id="hub-reply" aria-label="Reply address" placeholder="you@example.com" autocomplete="off" spellcheck="false"><p class="hub-hint">Your email address, or a link to a contact page like ${newTab('https://letterbird.co', 'Letterbird')}.</p></div>` : ''}</div></div>`;
    const tagsHTML = `<section>
    <h2 id="hub-tags-label">Tags</h2>
    <div class="hub-choices hub-tags" role="group" aria-labelledby="hub-tags-label">${TAGS.map((t) => `<button type="button" data-tags="${t.id}">${t.name}</button>`).join('')}</div>
    <p class="hub-hint hub-tags-hint"></p>
  </section>`;
    const upvoteHTML = `<section>
    <h2 id="hub-upvote-label">Upvote button</h2>
      <div class="hub-choices hub-upvotes" role="group" aria-labelledby="hub-upvote-label">${UPVOTES.map((u) => `<button type="button" data-upvote="${u.id}">${u.id === 'emoji' ? `<span class="hub-upvote-emoji" aria-hidden="true">${EMOJI}</span> ` : u.icon ? `<span aria-hidden="true">${u.icon}</span> ` : ''}${u.name}</button>`).join('')}</div>
      <div class="hub-field hub-emoji-field" hidden><input type="text" id="hub-upvote-emoji" aria-label="Upvote emoji" placeholder="${EMOJI}" autocomplete="off" spellcheck="false"><p class="hub-hint">Any emoji, like 🧸, 🍞 or ☕. It fades once toasted.</p></div>
      <p class="hub-hint hub-upvote-hint"></p>
  </section>`;
    const group = (g) => ADDONS.filter((a) => a.group === g).map(addonHTML).join('');

    panel.innerHTML = `
  <p class="message info hub-update" hidden>
    <span></span>
    <button type="button" data-act="update">Update</button>
  </p>
  <p class="message info hub-note" hidden>
    <span>${NOTE}</span>
    <button type="button" class="link-button" data-act="revert" hidden>Revert</button>
  </p>
  <section>
    <h2>Preview</h2>
    <div class="hub-previews"></div>
  </section>
  <section>
    <h2>Font</h2>
    <div class="hub-choices hub-fonts" role="group" aria-label="Fonts">${Object.entries(FONTS).map(([id, f]) => `<button type="button" data-font="${id}" style="font-family:${f.stack.replace(/"/g, "'")}">${f.name}</button>`).join('')}</div>
    <div class="hub-choices hub-sizes" role="group" aria-label="Text size">${SIZES.map((z) => `<button type="button" data-size="${z.id}">${z.name}</button>`).join('')}</div>
    <p class="hub-hint hub-size-hint"></p>
  </section>
  <section>
    <h2>Colors</h2>
    <div class="hub-choices hub-presets" role="group" aria-label="Color presets"></div>
    <div class="hub-choices hub-modes" role="group" aria-label="Light or dark">${MODES.map((m) => `<button type="button" data-mode="${m.id}">${m.name}</button>`).join('')}</div>
    <p class="hub-hint hub-mode-hint"></p>
    <div class="hub-custom" hidden>
      ${['light', 'dark'].map((mode) => `<fieldset data-for="${mode}"><legend>${mode === 'light' ? 'Light' : 'Dark'}</legend>${KEYS.map((k) => `<label>${LABELS[k]} <input type="color" data-mode="${mode}" data-key="${k}"></label>`).join('')}</fieldset>`).join('')}
      <p>Borders, muted text and visited links are worked out from these three.</p>
    </div>
  </section>
  <section>
    <h2>Links</h2>
    <div class="hub-choices hub-links" role="group" aria-label="Link style">${LINKS.map((l) => `<button type="button" data-links="${l.id}"><span class="hub-link-${l.id}">${l.name}</span></button>`).join('')}</div>
    <p class="hub-hint hub-links-hint"></p>
  </section>
  <hr class="hub-divider">
  <section>
    <h2>Width</h2>
    <div class="hub-choices hub-widths" role="group" aria-label="Page width">${WIDTHS.map((w) => `<button type="button" data-width="${w.id}"><svg class="hub-list-icon" viewBox="0 0 20 16" aria-hidden="true">${WIDTH_ICONS[w.id]}</svg>${w.name}</button>`).join('')}</div>
    <p class="hub-hint hub-widths-hint"></p>
  </section>
  <section>
    <h2>Header</h2>
    <div class="hub-choices hub-headers" role="group" aria-label="Header style">${HEADERS.map((h) => `<button type="button" data-header="${h.id}"><svg class="hub-list-icon" viewBox="0 0 20 16" aria-hidden="true">${HEADER_ICONS[h.id]}</svg>${h.name}</button>`).join('')}</div>
    <p class="hub-hint hub-headers-hint"></p>
  </section>
  <section>
    <h2>Blog list</h2>
    <div class="hub-choices hub-lists" role="group" aria-label="Blog list style">${LISTS.map((l) => `<button type="button" data-list="${l.id}"><svg class="hub-list-icon" viewBox="0 0 20 16" aria-hidden="true">${LIST_ICONS[l.id]}</svg>${l.name}</button>`).join('')}</div>
    <p class="hub-hint hub-lists-hint"></p>
  </section>
  <hr class="hub-divider">
  <section>
    <h2>Avatar</h2>
    <div class="hub-field">
      <input type="url" id="hub-avatar" aria-label="Avatar image link" placeholder="https://example.com/avatar.jpg" autocomplete="off" spellcheck="false">
    </div>
    <div class="hub-choices hub-shapes" role="group" aria-label="Avatar shape" hidden>${SHAPES.map((a) => `<button type="button" data-shape="${a.id}"><span class="hub-shape hub-shape-${a.id}" aria-hidden="true"></span>${a.name}</button>`).join('')}</div>
    <p class="hub-hint">An image beside your blog title. Paste its link from ${newTab(MEDIA_URL, 'Media')}.</p>
  </section>
  ${tagsHTML}
  ${upvoteHTML}
  <hr class="hub-divider">
  <section>
    <h2>Post extras</h2>
    <p class="hub-intro">Little additions at the end of each post.</p>
    <div class="hub-addons">${group('post')}</div>
  </section>
  <section>
    <h2>Blog extras</h2>
    <p class="hub-intro">Small touches around the blog.</p>
    <div class="hub-addons">${group('blog')}</div>
    <div class="message offer hub-footer">
      <div class="hub-footer-head"><span></span><button type="button" data-act="copy-footer">Copy</button></div>
      <pre></pre>
    </div>
  </section>
  <section class="hub-meta">
    <h2>Meta image</h2>
    <div class="hub-addon">
      <input type="checkbox" class="hub-switch" id="hub-meta-on">
      <div>
        <label for="hub-meta-on"><b>Make share images for your posts</b><span>A Meta image button in the editor turns the post title into an image in your style.</span></label>
        <div class="hub-meta-fields" hidden>
          <div class="hub-field"><label for="hub-meta-name">Name</label><input type="text" id="hub-meta-name" autocomplete="off"></div>
          <div class="hub-field"><label for="hub-meta-tagline">Domain or tagline</label><input type="text" id="hub-meta-tagline" autocomplete="off" spellcheck="false"></div>
          <label class="hub-meta-check"><input type="checkbox" id="hub-meta-avatar"> Show avatar</label>
          <p class="hub-hint">All optional. Here’s how a post will look when shared:</p>
          <canvas class="hub-meta-preview" width="1200" height="630" role="img" aria-label="Preview of a share image"></canvas>
        </div>
      </div>
    </div>
  </section>
  <details class="hub-own">
    <summary>Your CSS</summary>
    <p>Fine-tune the look of your blog with your own CSS. Kept when you update Björn.</p>
    <textarea spellcheck="false" aria-label="Your CSS"></textarea>
  </details>
  <p class="hub-credit">Björn by <a href="https://robertbirming.com/bjorn/" target="_blank" rel="noopener">Robert</a> · Enjoying it? <a href="https://ko-fi.com/birming" target="_blank" rel="noopener">Buy me a coffee</a></p>`;

    const $ = (s) => panel.querySelector(s);
    const fontsEl = $('.hub-fonts');
    const sizesEl = $('.hub-sizes');
    const sizeHint = $('.hub-size-hint');
    const presetsEl = $('.hub-presets');
    const modesEl = $('.hub-modes');
    const modeHint = $('.hub-mode-hint');
    const customEl = $('.hub-custom');
    const linksEl = $('.hub-links');
    const linksHint = $('.hub-links-hint');
    const avatarInput = $('#hub-avatar');
    const shapesEl = $('.hub-shapes');
    const listsEl = $('.hub-lists');
    const widthsEl = $('.hub-widths');
    const widthsHint = $('.hub-widths-hint');
    const headersEl = $('.hub-headers');
    const headersHint = $('.hub-headers-hint');
    const listsHint = $('.hub-lists-hint');
    const previewsEl = $('.hub-previews');
    const revertBtn = $('[data-act="revert"]');
    const noteEl = $('.hub-note');
    const noteText = noteEl.querySelector('span');
    const updateEl = $('.hub-update');
    const updateText = updateEl.querySelector('span');
    const updateBtn = $('[data-act="update"]');
    revertBtn.hidden = false;
    // Edits in the Custom CSS tab count too
    textarea.addEventListener('input', () => syncNote());
    const metaOn = $('#hub-meta-on');
    const metaFields = $('.hub-meta-fields');
    const metaName = $('#hub-meta-name');
    const metaTagline = $('#hub-meta-tagline');
    const metaAvatar = $('#hub-meta-avatar');
    const metaPreview = $('.hub-meta-preview');
    // Every switch and choice row below Meta image
    const addonsEl = panel;
    const tagsEl = $('.hub-tags');
    const tagsHint = $('.hub-tags-hint');
    const upvotesEl = $('.hub-upvotes');
    const emojiField = $('#hub-upvote-emoji');
    const emojiPreview = $('.hub-upvote-emoji');
    const upvoteHint = $('.hub-upvote-hint');
    const replyField = $('#hub-reply');
    const footerEl = $('.hub-footer');
    const footerCode = footerEl.querySelector('pre');
    const footerText = footerEl.querySelector('.hub-footer-head span');
    const copyBtn = $('[data-act="copy-footer"]');
    const ownEl = $('.hub-own');
    const ownInput = ownEl.querySelector('textarea');

    // Each font's name is shown in the font itself
    Object.keys(FONTS).forEach(ensureFont);

    /* ---------- Rendering ---------- */
    const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const mix = (a, b, t) => {
      const x = rgb(a), y = rgb(b);
      return `rgb(${x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(' ')})`;
    };
    const shown = () => (state.mode === 'auto' ? ['light', 'dark'] : [state.mode]);

    function previewHTML(label, c, f) {
      const muted = mix(c.text, c.bg, 0.7);
      const surface = mix(c.text, c.bg, 0.05);
      const border = mix(c.text, c.bg, 0.16);
      const size = Math.round(14 * scaleOf(state) * 100) / 100;
      const avatar = state.avatar ? `<span class="av ${state.avatarShape}" style="background-image:url('${state.avatar.replace(/'/g, '%27')}')"></span>` : '';
      return `<figure><figcaption>${label}</figcaption>
  <div class="hub-page ${state.links}" style="padding-inline:${WIDTHS.find((w) => w.id === state.width).pad};background:${c.bg};color:${c.text};font-family:${f.stack.replace(/"/g, "'")};font-size:${size}px">
    <div class="${state.avatar ? 'hd' : 'hn'} h-${state.header}">${avatar}<div class="t">Your blog</div>
    <div class="n"><span class="a" style="color:${c.link}">Home</span><span class="a" style="color:${c.link}">Blog</span></div></div>
    <p>Notes on small things, written slowly. Here is <span class="a" style="color:${c.link}">a link</span>, some <b>bold words</b> and a bit of <i>italic</i>.</p>
    <div class="q" style="background:${surface}">The best days leave room for a little curiosity.</div>
    <div class="l ${state.list}" style="--b:${border}">
      <div class="r"><span class="d" style="color:${muted}">14 Nov 2026</span><span class="a" style="color:${c.link}">A walk by the water</span></div>
      <div class="r"><span class="d" style="color:${muted}">02 Nov 2026</span><span class="a" style="color:${c.link}">Things I fixed this week</span></div>
    </div>
    <div class="f" style="border-top:1px solid ${border};color:${muted}">Powered by Bear ʕ•ᴥ•ʔ</div>
  </div></figure>`;
    }

    function render() {
      const f = FONTS[state.font];
      const c = colorsOf(state);
      const modes = shown();
      const swatch = modes.length === 1 ? modes[0] : 'light';

      fontsEl.querySelectorAll('[data-font]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.font === state.font));
      sizesEl.querySelectorAll('[data-size]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.size === state.size));
      sizeHint.textContent = SIZES.find((z) => z.id === state.size).hint;
      modesEl.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
      modeHint.textContent = MODES.find((m) => m.id === state.mode).hint;
      linksEl.querySelectorAll('[data-links]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.links === state.links));
      linksHint.textContent = LINKS.find((l) => l.id === state.links).hint;

      const choices = PRESETS.concat([{ id: 'custom', name: 'Custom', ...state.custom }]);
      presetsEl.innerHTML = choices.map((p) => `<button type="button" data-preset="${p.id}" aria-pressed="${p.id === state.preset}"><span class="hub-dots" aria-hidden="true">${KEYS.map((k) => `<span style="background:${p[swatch][k]}"></span>`).join('')}</span>${p.name}</button>`).join('');

      customEl.hidden = state.preset !== 'custom';
      customEl.querySelectorAll('fieldset').forEach((fs) => { fs.hidden = !modes.includes(fs.dataset.for); });
      customEl.querySelectorAll('input[type="color"]').forEach((input) => {
        input.value = state.custom[input.dataset.mode][input.dataset.key];
      });

      previewsEl.innerHTML = modes.map((m) => previewHTML(m === 'light' ? 'Light' : 'Dark', c[m], f)).join('');

      metaOn.checked = state.meta.on;
      metaFields.hidden = !state.meta.on;
      metaAvatar.closest('label').hidden = !state.avatar;
      shapesEl.hidden = !state.avatar;
      listsEl.querySelectorAll('[data-list]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.list === state.list));
      listsHint.textContent = LISTS.find((l) => l.id === state.list).hint;
      widthsEl.querySelectorAll('[data-width]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.width === state.width));
      widthsHint.textContent = WIDTHS.find((w) => w.id === state.width).hint;
      headersEl.querySelectorAll('[data-header]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.header === state.header));
      headersHint.textContent = HEADERS.find((h) => h.id === state.header).hint;
      shapesEl.querySelectorAll('[data-shape]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.shape === state.avatarShape));
      metaAvatar.checked = state.meta.avatar;
      drawPreview();

      addonsEl.querySelectorAll('[data-addon]').forEach((input) => { input.checked = state.addons[input.dataset.addon]; });
      tagsEl.querySelectorAll('[data-tags]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tags === state.tags));
      tagsHint.textContent = {
        bottom: 'After the post, as Bear has them. The blog page always keeps its tag list.',
        top: 'Next to the date, under the title. The blog page always keeps its tag list.',
        hidden: 'Gone from posts and pages. The blog page always keeps its tag list.'
      }[state.tags];
      upvotesEl.querySelectorAll('[data-upvote]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.upvote === state.upvote));
      emojiPreview.textContent = state.upvoteEmoji;
      emojiField.closest('.hub-field').hidden = state.upvote !== 'emoji';
      upvoteHint.innerHTML = state.upvote === 'hidden'
        ? `To also keep a post off Bear’s ${newTab('https://bearblog.dev/discover/', 'discovery feed')}, add <code>discoverable: false</code> to its header.`
        : `To hide the number, use “Hide upvotes” in Bear’s ${newTab(ADVANCED_URL, 'advanced settings')}.`;
      replyField.closest('.hub-field').hidden = !state.addons.reply;

      // The page can't see the footer, so the note stays as a reminder
      const lines = [`<script src="${HUB_SCRIPT}"></` + 'script>'];
      if (state.addons.latest) lines.unshift(LATEST);
      if (state.addons.post) lines.unshift(POST_NAV);
      const where = newTab(DIRECTIVES_URL, 'footer directive');
      const count = ['this line', 'these two lines', 'these three lines'][lines.length - 1];
      footerText.innerHTML = `Make sure your ${where} has ${count}:`;
      footerCode.textContent = lines.join('\n');

      syncNote();
    }

    // Text fields are only filled in from the state on load and revert,
    // so typing never moves the cursor
    // Only the newest drawing lands, however fast the settings change
    let drawn = 0;
    function drawPreview() {
      if (!state.meta.on) return;
      const mine = ++drawn;
      const snapshot = structuredClone(state);
      const scratch = document.createElement('canvas');
      drawMeta(snapshot, 'A walk by the water', scratch).then(() => {
        if (mine !== drawn) return;
        metaPreview.getContext('2d').drawImage(scratch, 0, 0);
      }).catch((error) => console.error('Björn dashboard (meta preview):', error));
    }

    function fillFields() {
      metaName.value = state.meta.name;
      metaTagline.value = state.meta.tagline;
      avatarInput.value = state.avatar;
      replyField.value = state.reply;
      emojiField.value = state.upvoteEmoji;
      ownInput.value = readOwn(textarea.value);
      ownEl.open = !!ownInput.value;
    }

    // The note only shows while there's something to publish
    function syncNote() {
      noteEl.hidden = textarea.value === original;
    }

    function apply() {
      textarea.value = writeSettings(textarea.value, settingsBlock(state));
      // Lets Bear's CSS editor redraw its highlighting
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      render();
    }

    /* ---------- Events ---------- */
    fontsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-font]');
      if (!b || b.dataset.font === state.font) return;
      state.font = b.dataset.font;
      apply();
    });

    presetsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-preset]');
      if (!b) return;
      const id = b.dataset.preset;
      // Custom starts from the colors on screen, so it's a small step from a preset
      if (id === 'custom' && state.preset !== 'custom') state.custom = copy(colorsOf(state));
      state.preset = id;
      apply();
      presetsEl.querySelector(`[data-preset="${id}"]`)?.focus();
    });

    sizesEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-size]');
      if (!b || b.dataset.size === state.size) return;
      state.size = b.dataset.size;
      apply();
    });

    linksEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-links]');
      if (!b || b.dataset.links === state.links) return;
      state.links = b.dataset.links;
      apply();
    });

    modesEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mode]');
      if (!b || b.dataset.mode === state.mode) return;
      state.mode = b.dataset.mode;
      apply();
    });

    customEl.addEventListener('input', (e) => {
      const input = e.target.closest('input[type="color"]');
      if (!input) return;
      state.custom[input.dataset.mode][input.dataset.key] = input.value.toLowerCase();
      state.preset = 'custom';
      apply();
    });

    avatarInput.addEventListener('input', () => {
      const v = clean(avatarInput.value);
      state.avatar = /^https:\/\/\S+$/.test(v) ? v : '';
      apply();
    });

    widthsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-width]');
      if (!b || b.dataset.width === state.width) return;
      state.width = b.dataset.width;
      apply();
    });

    headersEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-header]');
      if (!b || b.dataset.header === state.header) return;
      state.header = b.dataset.header;
      apply();
    });

    listsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-list]');
      if (!b || b.dataset.list === state.list) return;
      state.list = b.dataset.list;
      apply();
    });

    shapesEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-shape]');
      if (!b || b.dataset.shape === state.avatarShape) return;
      state.avatarShape = b.dataset.shape;
      apply();
    });

    metaOn.addEventListener('change', () => {
      state.meta.on = metaOn.checked;
      apply();
      if (state.meta.on && !state.meta.name) metaName.focus();
    });

    metaName.addEventListener('input', () => { state.meta.name = plain(metaName.value); apply(); });
    metaTagline.addEventListener('input', () => { state.meta.tagline = plain(metaTagline.value); apply(); });
    metaAvatar.addEventListener('change', () => { state.meta.avatar = metaAvatar.checked; apply(); });

    addonsEl.addEventListener('change', (e) => {
      const input = e.target.closest('[data-addon]');
      if (!input) return;
      state.addons[input.dataset.addon] = input.checked;
      apply();
      if (input.dataset.addon === 'reply' && input.checked && !state.reply) replyField.focus();
    });

    tagsEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tags]');
      if (!b || b.dataset.tags === state.tags) return;
      state.tags = b.dataset.tags;
      apply();
    });

    upvotesEl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-upvote]');
      if (!b || b.dataset.upvote === state.upvote) return;
      state.upvote = b.dataset.upvote;
      apply();
      if (state.upvote === 'emoji') emojiField.focus();
    });

    emojiField.addEventListener('input', () => {
      const v = oneEmoji(emojiField.value);
      if (!v || v === state.upvoteEmoji) return;
      state.upvoteEmoji = v;
      apply();
    });

    replyField.addEventListener('input', () => {
      const v = clean(replyField.value);
      state.reply = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^https:\/\/\S+$/.test(v) ? v : '';
      apply();
    });

    ownInput.addEventListener('input', () => {
      textarea.value = writeOwn(textarea.value, ownInput.value);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      syncNote();
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(footerCode.textContent);
        copyBtn.textContent = 'Copied';
      } catch {
        copyBtn.textContent = 'Copy failed';
      }
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    });

    revertBtn.addEventListener('click', () => {
      textarea.value = original;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      noteText.innerHTML = NOTE;
      // Undoing a fresh install goes back to the Install button
      if (!original.includes(THEME_MARK)) return installView();
      state = readState(original);
      fillFields();
      render();
      checkUpdate();
    });

    /* ---------- Updates: a newer release on the channel ---------- */
    let release = null;
    async function checkUpdate() {
      updateEl.hidden = true;
      try {
        const latest = await latestRelease();
        if (!newer(latest, installedVersion(textarea.value))) return;
        release = await fetchRelease(latest);
        updateText.textContent = `Björn ${release.version} is ready.${release.notes ? ` New: ${release.notes}` : ''}`;
        updateBtn.disabled = false;
        updateEl.hidden = false;
      } catch (error) {
        console.info('Björn dashboard (update check):', error.message);
      }
    }

    updateBtn.addEventListener('click', () => {
      if (!release) return;
      textarea.value = updateCss(textarea.value, release);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      updateEl.hidden = true;
      noteText.innerHTML = `Updated to Björn ${release.version}. Press <b>Publish</b> to put it on your blog, or Revert to undo.`;
      render();
    });

    if (installed) noteText.innerHTML = installed;
    fillFields();
    render();
    if (!installed) checkUpdate();
    }
  }

  /* ---------- Format: a small Markdown toolbar in the post editor, with Gallery ---------- */
  function format() {
    const ta = document.getElementById('body_content');
    const bar = document.querySelector('.helptext.sticky');
    if (!ta || !bar || document.getElementById('hub-format')) return;

    // Wait until every other plugin has had its turn, then step aside if
    // another toolbar is already here: the old Markdown toolbar, or an
    // editor that hides Bear's bar (like Markdown Power-Editor)
    setTimeout(() => {
      if (ta.hasAttribute('data-md-toolbar') || document.getElementById('md-toolbar')) return;
      if (getComputedStyle(bar).display === 'none') return;
      build();
    }, 0);

    function build() {
      const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent;
      const isMac = /Mac|iPhone|iPad|iPod/i.test(platform);
      const MOD = isMac ? 'Cmd' : 'Ctrl';
      const KEY = isMac ? 'Meta' : 'Control';
      const STORE = 'hub-format-open';

      const style = document.createElement('style');
      style.textContent = `
#hub-format{display:flex;flex-wrap:wrap;align-items:center;flex-basis:100%;gap:2px;margin:-3px 0 3px;padding:6px 0 4px;border-top:1px solid var(--border);font-size:inherit}
#hub-format[hidden]{display:none}
#hub-format button,#hub-format-toggle{margin:0;padding:2px 7px;font:inherit;line-height:1.4;color:var(--link-color);background:none;border:0;border-radius:var(--radius);cursor:pointer}
#hub-format-toggle{padding:0;font-size:inherit}
#hub-format button:hover,#hub-format-toggle:hover,#hub-format-toggle[aria-expanded="true"]{color:var(--text-color);background:none}
#hub-format button:focus-visible,#hub-format-toggle:focus-visible{outline:2px solid var(--link-color);outline-offset:1px}
#hub-format .hub-b{font-weight:700}
#hub-format .hub-i{font-style:italic}
#hub-format .hub-sep{padding:0 4px;color:var(--muted);user-select:none}
`;
      document.head.append(style);

      /* The toolbar, just above Bear's bar */
      const BUTTONS = [
        { label: 'B', name: 'Bold', key: 'B', cls: 'hub-b', run: () => wrap('**') },
        { label: 'I', name: 'Italic', key: 'I', cls: 'hub-i', run: () => wrap('*') },
        { label: 'Link', name: 'Link', run: link },
        '|',
        { label: '"', name: 'Quote', run: () => lines('quote') },
        { label: '•', name: 'Bullet list', run: () => lines('list') },
        { label: '1.', name: 'Numbered list', run: () => lines('numbered') },
        '|',
        { label: 'Code', name: 'Code block', run: codeBlock },
        '|',
        { label: 'Gallery', name: 'Gallery', run: () => gallery() }
      ];

      // The standalone Gallery upload plugin brings its own link, so no second one
      if (document.getElementById('gu-overlay')) BUTTONS.splice(-2);

      const toolbar = document.createElement('div');
      toolbar.id = 'hub-format';
      toolbar.setAttribute('role', 'group');
      toolbar.setAttribute('aria-label', 'Format');

      for (const def of BUTTONS) {
        if (def === '|') {
          const sep = document.createElement('span');
          sep.className = 'hub-sep';
          sep.setAttribute('aria-hidden', 'true');
          sep.textContent = '|';
          toolbar.append(sep);
          continue;
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = def.label;
        if (def.cls) button.className = def.cls;
        if (def.label !== def.name) button.setAttribute('aria-label', def.name);
        button.title = def.key ? `${def.name} (${MOD}+${def.key})` : def.name;
        if (def.key) button.setAttribute('aria-keyshortcuts', `${KEY}+${def.key}`);
        button.addEventListener('click', def.run);
        toolbar.append(button);
      }

      // Clicks keep the focus, and the selection, in the post
      toolbar.addEventListener('mousedown', (event) => {
        if (event.target.closest('button')) event.preventDefault();
      });

      // Inside Bear's sticky bar, on its own row, so the tools stay
      // at the bottom of the screen with it while you write
      bar.style.flexWrap = 'wrap';
      bar.prepend(toolbar);

      // Safari can skip drawing what's added to a sticky bar until it
      // moves. A quick hop out of sticky and back makes it draw now
      const redraw = () => requestAnimationFrame(() => {
        bar.style.position = 'static';
        void bar.offsetHeight;
        bar.style.position = '';
      });

      /* The Format link beside "Markdown syntax", remembering open or closed */
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.id = 'hub-format-toggle';
      toggle.textContent = 'Format';
      toggle.setAttribute('aria-controls', 'hub-format');

      const setOpen = (open) => {
        toolbar.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        redraw();
      };
      let saved = false;
      try { saved = localStorage.getItem(STORE) === '1'; } catch { /* storage blocked */ }
      setOpen(saved);

      toggle.addEventListener('click', () => {
        const open = toolbar.hidden;
        setOpen(open);
        try { localStorage.setItem(STORE, open ? '1' : '0'); } catch { /* storage blocked */ }
      });

      const left = bar.querySelector(':scope > span') || bar;
      left.append(' | ', toggle);

      metaImage();

      /* Shortcuts, also with the toolbar closed */
      ta.addEventListener('keydown', (event) => {
        if (event.isComposing || event.shiftKey || event.altKey) return;
        if (isMac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return;
        const key = event.key.toLowerCase();
        const action = { b: () => wrap('**'), i: () => wrap('*'), k: () => wrap('`'), u: unwrapAny }[key];
        if (!action) return;
        event.preventDefault();
        action();
      });

      /* ---------- Editing ---------- */

      // Every change goes through here. insertText keeps Cmd+Z working;
      // setRangeText is the fallback where it isn't supported
      function replace(start, end, text, selStart = start + text.length, selEnd = selStart) {
        ta.focus();
        ta.setSelectionRange(start, end);
        let done = false;
        try { done = document.execCommand('insertText', false, text); } catch { /* not supported */ }
        if (!done) {
          ta.setRangeText(text, start, end, 'end');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
        }
        ta.setSelectionRange(selStart, selEnd);
      }

      // The selection without the spaces around it, so "word " becomes **word**
      function selection() {
        const v = ta.value;
        let s = ta.selectionStart;
        let e = ta.selectionEnd;
        while (s < e && /\s/.test(v[s])) s++;
        while (e > s && /\s/.test(v[e - 1])) e--;
        return { v, s, e };
      }

      // How many of the same marker character sit side by side from i, going left or right
      function run(v, i, dir, ch) {
        let n = 0;
        while (v[dir < 0 ? i - 1 - n : i + n] === ch) n++;
        return n;
      }

      // Is this marker around the text? Star runs of 3 mean bold and italic together
      function hasMarker(left, right, marker) {
        if (marker === '`') return left >= 1 && right >= 1;
        const fits = (n) => (marker === '*' ? n === 1 || n === 3 : n === 2 || n === 3);
        return fits(left) && fits(right);
      }

      function wrap(marker) {
        const { v, s, e } = selection();
        const ch = marker[0];
        const size = marker.length;

        if (s === e) {
          const word = marker === '`' ? 'code' : 'text';
          replace(s, e, marker + word + marker, s + size, s + size + word.length);
          return;
        }

        // Markers just outside the selection: remove them
        if (hasMarker(run(v, s, -1, ch), run(v, e, 1, ch), marker)) {
          replace(s - size, e + size, v.slice(s, e), s - size, e - size);
          return;
        }

        // Markers just inside the selection: remove them
        const inner = v.slice(s, e);
        if (inner.length > size * 2 && hasMarker(run(inner, 0, 1, ch), run(inner, inner.length, -1, ch), marker)) {
          const text = inner.slice(size, -size);
          replace(s, e, text, s, s + text.length);
          return;
        }

        replace(s, e, marker + inner + marker, s + size, e + size);
      }

      // Cmd+U: remove the bold, italic or code around the cursor or selection
      function unwrapAny() {
        const v = ta.value;
        let s = ta.selectionStart;
        let e = ta.selectionEnd;

        if (s === e) {
          // The word under the cursor, without punctuation around it
          while (s > 0 && !/\s/.test(v[s - 1])) s--;
          while (e < v.length && !/\s/.test(v[e])) e++;
          while (s < e && /[("'“‘[]/.test(v[s])) s++;
          while (e > s && /[.,;:!?)"'”’\]]/.test(v[e - 1])) e--;
        } else {
          // Reach out over markers right next to the selection
          while (s > 0 && /[*`]/.test(v[s - 1])) s--;
          while (e < v.length && /[*`]/.test(v[e])) e++;
        }

        const ch = v[s];
        if (ch !== '*' && ch !== '`') return;
        const n = Math.min(run(v, s, 1, ch), run(v, e, -1, ch));
        if (!n || e - s <= n * 2) return;
        const text = v.slice(s + n, e - n);
        replace(s, e, text, s, s + text.length);
      }

      // Quote, bullet list and numbered list. Click again to remove.
      // Blank lines are left alone, except inside a quote, where they keep it together.
      function lines(kind) {
        const v = ta.value;
        const s = ta.selectionStart;
        let e = ta.selectionEnd;
        if (e > s && v[e - 1] === '\n') e--;
        const start = v.lastIndexOf('\n', s - 1) + 1;
        const end = v.indexOf('\n', e) === -1 ? v.length : v.indexOf('\n', e);
        const rows = v.slice(start, end).split('\n');
        const filled = rows.filter((row) => row.trim());
        if (!filled.length && kind !== 'quote') {
          const mark = kind === 'list' ? '- ' : '1. ';
          replace(start, end, mark + rows[0]);
          return;
        }

        const BULLET = /^(\s*)[-*+] /;
        const NUMBER = /^(\s*)\d+[.)] /;
        const QUOTE = /^> ?/;
        let out;

        if (kind === 'quote') {
          if (filled.length && filled.every((row) => QUOTE.test(row))) {
            out = rows.map((row) => row.replace(QUOTE, '').replace(/(\S) {2}$/, '$1'));
          } else {
            // Two spaces keep line breaks inside the quote
            out = rows.map((row, i) => {
              if (!row.trim()) return '>';
              const next = rows[i + 1];
              return '> ' + row + (next && next.trim() ? '  ' : '');
            });
          }
        } else {
          const own = kind === 'list' ? BULLET : NUMBER;
          if (filled.every((row) => own.test(row))) {
            out = rows.map((row) => row.replace(own, '$1'));
          } else {
            let n = 0;
            out = rows.map((row) => {
              if (!row.trim()) return row;
              const bare = row.replace(BULLET, '$1').replace(NUMBER, '$1');
              const indent = bare.match(/^\s*/)[0];
              return indent + (kind === 'list' ? '- ' : `${++n}. `) + bare.slice(indent.length);
            });
          }
        }

        const text = out.join('\n');
        replace(start, end, text, start, start + text.length);
      }

      // A fenced code block on its own lines, with the cursor ready inside
      function codeBlock() {
        const v = ta.value;
        const s = ta.selectionStart;
        const e = ta.selectionEnd;
        const code = v.slice(s, e).replace(/\n+$/, '');
        const before = s > 0 && v[s - 1] !== '\n' ? '\n' : '';
        const after = e < v.length && v[e] !== '\n' ? '\n' : '';
        const open = before + '```\n';
        const text = open + code + '\n```' + after;
        const inside = s + open.length;
        replace(s, e, text, inside, inside + code.length);
      }

      // [text](url) with the cursor in the brackets. A selected URL becomes the link
      function link() {
        const { v, s, e } = selection();
        const text = v.slice(s, e);
        if (/^https?:\/\/\S+$/.test(text)) {
          replace(s, e, `[](${text})`, s + 1);
          return;
        }
        const label = text || 'link text';
        replace(s, e, `[${label}]()`, s + label.length + 3);
      }

      /* ---------- Gallery: upload several photos at once ---------- */

      let gallery = () => {
        const g = galleryDialog();
        gallery = g.open;
        g.open();
      };
      // Built the first time Gallery is clicked
      function galleryDialog() {
        const slug = location.pathname.split('/').filter(Boolean)[0];
        const UPLOAD_URL = `/${slug}/dashboard/upload-image/`;
        const MAX_SIZE = 10 * 1024 * 1024; // Bear's own limit

        const css = document.createElement('style');
        css.textContent = `
#hub-gallery{width:min(640px,calc(100% - 40px));max-height:90vh;padding:0;color:var(--text-color);background:var(--background-color);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 32px rgb(0 0 0/.2)}
#hub-gallery::backdrop{background:rgb(0 0 0/.3)}
@media (prefers-color-scheme:dark){#hub-gallery::backdrop{background:rgb(0 0 0/.5)}}
#hub-gallery.is-dropping{outline:2px dashed var(--link-color);outline-offset:-8px}
#hub-gallery .hg-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)}
#hub-gallery .hg-head h2{margin:0;font-size:1em;color:var(--heading-color)}
#hub-gallery .hg-body{padding:16px}
#hub-gallery .hg-muted{display:block;margin:6px 0 0;font-size:small;color:var(--muted)}
#hub-gallery .hg-muted[hidden]{display:none}
#hub-gallery input[type="file"]{width:auto;padding:0;background:none;font:inherit}
#hub-gallery .hg-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
#hub-gallery .hg-thumbs:empty{display:none}
#hub-gallery.is-busy .hg-thumbs{pointer-events:none}
#hub-gallery .hg-thumb{position:relative;width:96px;cursor:grab}
#hub-gallery .hg-thumb img{display:block;width:96px;height:96px;object-fit:cover;border-radius:var(--radius);pointer-events:none}
#hub-gallery .hg-thumb.is-target img{outline:2px solid var(--link-color);outline-offset:2px}
#hub-gallery .hg-name{margin-top:3px;overflow:hidden;font-size:9px;white-space:nowrap;text-overflow:ellipsis;color:var(--muted)}
#hub-gallery .hg-thumb.is-error .hg-name{white-space:normal;color:#e5484d}
#hub-gallery .hg-caption{box-sizing:border-box;width:96px;margin:4px 0 0;padding:3px 5px;font-size:12px;line-height:1.3;color:inherit;background:none;border:1px solid var(--border);border-radius:var(--radius)}
#hub-gallery .hg-remove{position:absolute;top:3px;left:3px;width:20px;height:20px;margin:0;padding:0;font-size:14px;line-height:20px;color:#fff;background:rgb(0 0 0/.6);border:0;border-radius:50%;opacity:0;cursor:pointer}
#hub-gallery .hg-thumb:hover .hg-remove,#hub-gallery .hg-remove:focus-visible{opacity:1}
#hub-gallery.is-busy .hg-remove{display:none}
#hub-gallery .hg-badge{position:absolute;top:3px;right:3px;display:grid;place-items:center;width:18px;height:18px;font-size:11px;font-weight:700;color:#fff;border-radius:50%}
#hub-gallery .hg-badge:empty{display:none}
#hub-gallery .is-done .hg-badge{background:#30a46c}
#hub-gallery .is-error .hg-badge{background:#e5484d}
#hub-gallery .is-uploading{opacity:.4}
#hub-gallery label.hg-option{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:.9em;font-weight:400;cursor:pointer}
#hub-gallery label.hg-option input{width:auto;margin:0}
#hub-gallery .hg-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:4px}
#hub-gallery .hg-status{font-size:small;color:var(--muted)}
`;
        document.head.append(css);

        const dialog = document.createElement('dialog');
        dialog.id = 'hub-gallery';
        dialog.setAttribute('aria-labelledby', 'hub-gallery-title');
        dialog.innerHTML = `
<div class="hg-head"><h2 id="hub-gallery-title">Gallery</h2><button type="button" class="hg-close">Close</button></div>
<div class="hg-body">
  <input type="file" multiple accept="image/*" aria-describedby="hub-gallery-limit">
  <span class="hg-muted" id="hub-gallery-limit">Pick or drop photos, max 10 MB each</span>
  <span class="hg-muted hg-hint" hidden>Drag to reorder · Descriptions help screen readers</span>
  <div class="hg-thumbs"></div>
  <label class="hg-option"><input type="checkbox" class="hg-raw"> Keep original quality (skip Bear's optimisation)</label>
  <div class="hg-actions"><button type="button" class="hg-upload" disabled>Upload</button><span class="hg-status" aria-live="polite"></span></div>
</div>`;
        document.body.append(dialog);

        const $ = (sel) => dialog.querySelector(sel);
        const closeButton = $('.hg-close');
        const fileInput = $('input[type="file"]');
        const hint = $('.hg-hint');
        const thumbs = $('.hg-thumbs');
        const rawCheck = $('.hg-raw');
        const uploadButton = $('.hg-upload');
        const status = $('.hg-status');
        const opener = toolbar.querySelector('button:last-of-type');

        let items = []; // { file, caption, result: undefined | 'done' | 'error', message }
        let busy = false;
        let at = 0; // where the photos go in the post
        let controller = null;
        let dragFrom = null;
        let joined = false; // a retry joins the photos already in the post

        const key = (f) => `${f.name}|${f.size}|${f.lastModified}`;
        const plural = (n) => `${n} photo${n === 1 ? '' : 's'}`;

        function open() {
          items = [];
          at = ta.selectionEnd;
          joined = false;
          fileInput.value = '';
          render();
          dialog.showModal();
          fileInput.focus();
        }

        function close() {
          if (busy) return;
          dialog.close();
        }

        // No closing halfway through an upload
        dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
        dialog.addEventListener('close', () => { controller?.abort(); opener?.focus(); });
        dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
        closeButton.addEventListener('click', close);

        // Add to the photos already picked, so they can come a few at a time.
        // After a finished upload, a new pick starts over
        function add(files) {
          if (items.some((item) => item.result === 'done')) items = [];
          const seen = new Set(items.map((item) => key(item.file)));
          for (const file of files) {
            if (!file.type.startsWith('image/') || seen.has(key(file))) continue;
            seen.add(key(file));
            items.push({ file, caption: '' });
          }
          render();
        }

        fileInput.addEventListener('change', (event) => {
          event.stopImmediatePropagation();
          add([...fileInput.files]);
          fileInput.value = '';
        }, true);

        // Dropping photos on the dialog. Stopping here also keeps Bear's own
        // drop handler from uploading them into the post behind it
        const hasFiles = (event) => event.dataTransfer?.types.includes('Files');
        dialog.addEventListener('dragover', (event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          event.stopPropagation();
          if (!busy) dialog.classList.add('is-dropping');
        });
        dialog.addEventListener('dragleave', (event) => {
          if (event.target === dialog) dialog.classList.remove('is-dropping');
        });
        dialog.addEventListener('drop', (event) => {
          if (!hasFiles(event)) return;
          event.preventDefault();
          event.stopPropagation();
          dialog.classList.remove('is-dropping');
          if (!busy) add([...event.dataTransfer.files]);
        });

        function render() {
          thumbs.replaceChildren(...items.map(thumb));
          const waiting = items.filter((item) => item.result !== 'done').length;
          const done = items.length - waiting;
          const failed = items.some((item) => item.result === 'error');
          hint.hidden = !items.length || done > 0;
          uploadButton.textContent = done && failed ? 'Retry failed' : 'Upload';
          uploadButton.disabled = busy || !waiting;
          if (!busy && !items.some((item) => item.result)) status.textContent = items.length ? `${plural(items.length)} selected` : '';
        }

        function thumb(item, i) {
          const wrap = document.createElement('div');
          wrap.className = 'hg-thumb' + (item.result ? ` is-${item.result}` : '');
          wrap.draggable = !items.some((it) => it.result === 'done');

          const img = document.createElement('img');
          const url = URL.createObjectURL(item.file);
          img.src = url;
          img.alt = '';
          img.onload = img.onerror = () => URL.revokeObjectURL(url);

          const name = document.createElement('div');
          name.className = 'hg-name';
          name.textContent = item.result === 'error' ? item.message : item.file.name;

          const caption = document.createElement('input');
          caption.type = 'text';
          caption.className = 'hg-caption';
          caption.placeholder = 'Description';
          caption.value = item.caption;
          caption.setAttribute('aria-label', `Description for ${item.file.name}`);
          caption.addEventListener('input', () => { item.caption = caption.value; });
          caption.addEventListener('mousedown', (event) => event.stopPropagation());
          caption.draggable = false;

          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'hg-remove';
          remove.textContent = '×';
          remove.setAttribute('aria-label', `Remove ${item.file.name}`);
          remove.addEventListener('click', () => { items.splice(i, 1); render(); });

          const badge = document.createElement('div');
          badge.className = 'hg-badge';
          badge.setAttribute('aria-hidden', 'true');
          badge.textContent = item.result === 'done' ? '✓' : item.result === 'error' ? '✕' : '';

          // Drag to reorder
          wrap.addEventListener('dragstart', (event) => {
            dragFrom = i;
            event.dataTransfer.effectAllowed = 'move';
          });
          wrap.addEventListener('dragover', (event) => {
            if (dragFrom === null) return;
            event.preventDefault();
            event.stopPropagation();
            wrap.classList.add('is-target');
          });
          wrap.addEventListener('dragleave', () => wrap.classList.remove('is-target'));
          wrap.addEventListener('drop', (event) => {
            if (dragFrom === null) return;
            event.preventDefault();
            event.stopPropagation();
            const [moved] = items.splice(dragFrom, 1);
            items.splice(i, 0, moved);
            dragFrom = null;
            render();
          });
          wrap.addEventListener('dragend', () => { dragFrom = null; render(); });

          wrap.append(img, name, caption, badge, remove);
          return wrap;
        }

        // One photo through Bear's own upload, the same one Insert media uses
        async function upload(file, raw) {
          if (file.size > MAX_SIZE) throw new Error('Over 10 MB');
          const csrf = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
          const body = new FormData();
          body.append('file', file);
          body.append('csrfmiddlewaretoken', csrf);
          if (raw) body.append('raw', 'true');
          const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            body,
            headers: { 'X-CSRFToken': csrf },
            credentials: 'same-origin',
            signal: controller.signal
          });
          let data = null;
          try { data = await response.json(); } catch { /* not JSON */ }
          const urls = Array.isArray(data) ? data : data?.urls;
          if (response.ok && Array.isArray(urls) && urls.length) return urls;
          throw new Error(data?.error || `HTTP ${response.status}`);
        }

        // The description is the photo's alt text: screen readers read it,
        // and in a gallery the lightbox shows it. Captions are the theme's
        // italic line under a photo, so none are added here
        const noBrackets = (str) => str.replace(/[[\]]/g, '');

        // Every photo gets #gallery: that's what the button is for
        function markdown(url, name, caption) {
          return `![${noBrackets(caption || name)}](${url}#gallery)`;
        }

        // The photos as their own paragraph, with blank lines around
        // when they land next to text
        function insert(text) {
          const v = ta.value;
          const pos = Math.min(at, v.length);
          let lead = '';
          if (joined) lead = '\n';
          else if (pos > 0 && v[pos - 1] !== '\n') lead = '\n\n';
          else if (pos > 1 && v[pos - 2] !== '\n') lead = '\n';
          let tail = '';
          if (pos === v.length) tail = '\n';
          else if (v[pos] !== '\n') tail = '\n\n';
          else if (pos + 1 < v.length && v[pos + 1] !== '\n') tail = '\n';
          replace(pos, pos, lead + text + tail);
          at = pos + lead.length + text.length;
          joined = true;
        }

        uploadButton.addEventListener('click', async () => {
          const todo = items.filter((item) => item.result !== 'done');
          if (busy || !todo.length) return;

          busy = true;
          controller = new AbortController();
          dialog.classList.add('is-busy');
          closeButton.disabled = fileInput.disabled = true;
          render();

          const raw = rawCheck.checked;
          const lines = [];
          let failed = 0;

          for (const [n, item] of todo.entries()) {
            status.textContent = `Uploading ${n + 1} of ${todo.length}…`;
            item.result = undefined;
            const el = thumbs.children[items.indexOf(item)];
            el?.classList.add('is-uploading');
            try {
              const urls = await upload(item.file, raw);
              const name = item.file.name.replace(/\.[^/.]+$/, '');
              lines.push(...urls.map((url) => markdown(url, name, item.caption.trim())));
              item.result = 'done';
            } catch (error) {
              if (error.name === 'AbortError') break;
              item.result = 'error';
              item.message = error.message;
              failed++;
            }
            el?.classList.remove('is-uploading');
            if (el) el.className = `hg-thumb is-${item.result}`;
          }

          // All the photos go in at once, so one Cmd+Z takes them out again
          if (lines.length) insert(lines.join('\n'));

          busy = false;
          controller = null;
          dialog.classList.remove('is-busy');
          closeButton.disabled = fileInput.disabled = false;
          status.textContent = failed
            ? `${lines.length} uploaded, ${failed} failed.`
            : `Done. ${plural(lines.length)} added.`;
          render();
          if (!failed && lines.length) setTimeout(() => { if (!busy) dialog.close(); }, 1200);
        });

        return { open };
      }

      /* ---------- Meta image: switched on under Themes, Björn tab ---------- */

      function metaImage() {
        const header = document.getElementById('header_content');
        const base = location.pathname.match(/^\/[^/]+\/dashboard\//)?.[0];
        // Posts and pages, not the home page. And never next to the standalone Meta image plugin
        if (!header || !base || !location.pathname.includes('/dashboard/posts/')) return;
        if ([...bar.querySelectorAll('a')].some((a) => a.textContent.trim() === 'Meta image')) return;

        // The post editor can't see the theme, so the settings come from the Themes page
        const den = async () => {
          const response = await fetch(`${base}styles/`, { credentials: 'same-origin' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
          const css = doc.querySelector('textarea[name="custom_styles"]')?.textContent || '';
          return css.includes(THEME_MARK) ? readState(css) : null;
        };

        den().then((state) => {
          if (state?.meta.on) addButton();
        }).catch((error) => console.error('Björn dashboard (meta image):', error));

        const headerText = () => header.innerText ??
          [...header.childNodes].map((n) => (n.nodeName === 'BR' ? '\n' : n.textContent)).join('');
        const setting = (key) =>
          (headerText().match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'mi')) || [])[1]?.trim() || '';

        // Bear shows each setting as <b>key:</b> value<br>
        function setMetaImage(url) {
          const label = [...header.querySelectorAll('b')].find((b) => b.textContent.trim() === 'meta_image:');
          if (label) {
            let node = label.nextSibling;
            while (node && node.nodeName !== 'BR') {
              const next = node.nextSibling;
              node.remove();
              node = next;
            }
            label.after(` ${url}`);
            return;
          }
          // The last setting often has no <br> after it
          const last = [...header.childNodes].reverse().find((n) => !(n.nodeType === 3 && !n.textContent.trim()));
          if (last && last.nodeName !== 'BR') header.append(document.createElement('br'));
          const b = document.createElement('b');
          b.textContent = 'meta_image:';
          header.append(b, ` ${url}`);
        }

        const slugify = (str) => str.normalize('NFD').replace(/\p{Diacritic}/gu, '')
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meta-image';

        async function upload(blob, filename) {
          const csrf = document.querySelector('[name="csrfmiddlewaretoken"]')?.value || '';
          const body = new FormData();
          body.append('file', blob, filename);
          const response = await fetch(`${base}upload-image/`, {
            method: 'POST', body, headers: { 'X-CSRFToken': csrf }, credentials: 'same-origin'
          });
          const data = await response.json().catch(() => null);
          const url = (Array.isArray(data) ? data : data?.urls)?.[0];
          if (!response.ok || typeof url !== 'string' || !url.trim()) throw new Error(data?.error || 'Upload failed');
          return url;
        }

        function download(blob, filename) {
          const url = URL.createObjectURL(blob);
          const a = Object.assign(document.createElement('a'), { href: url, download: filename });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }

        function addButton() {
          const sep = document.createElement('span');
          sep.className = 'hub-sep';
          sep.setAttribute('aria-hidden', 'true');
          sep.textContent = '|';
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Meta image';
          button.title = 'Make a share image from the title';
          toolbar.append(sep, button);
          redraw();

          let busy = false;
          let timer;
          const say = (text, reset) => {
            clearTimeout(timer);
            button.textContent = text;
            if (reset) timer = setTimeout(() => { button.textContent = 'Meta image'; }, 3000);
          };

          button.addEventListener('click', async () => {
            if (busy) return;
            if (setting('meta_image') && !confirm('This post already has a meta image. Replace it?')) return;
            busy = true;
            try {
              say('Creating…');
              const state = await den();
              if (!state) throw new Error('No Björn settings found');
              const title = setting('title');
              const filename = `${slugify(setting('link') || title)}-og.png`;
              const canvas = await drawMeta(state, title);
              const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
              if (!blob) throw new Error('Could not create image');
              let url;
              try {
                say('Uploading…');
                url = await upload(blob, filename);
              } catch (error) {
                console.error('Björn dashboard (meta image):', error);
                download(blob, filename);
                say('Downloaded instead', true);
                return;
              }
              setMetaImage(url);
              say('Added ✓ Save the post', true);
            } catch (error) {
              console.error('Björn dashboard (meta image):', error);
              say('Couldn’t create it', true);
            } finally {
              busy = false;
            }
          });
        }
      }
    }
  }

  // Whether the Status switch is on, remembered in this browser so the nav
  // link shows without loading the Themes page on every dashboard page
  // One per blog, since blogs on the same account share the dashboard script
  const STATUS_KEY = `hub-status:${dashboardBase}`;
  function rememberStatus(on) {
    try { localStorage.setItem(STATUS_KEY, JSON.stringify({ on, checked: Date.now() })); } catch {}
  }

  /* ---------- Status: a link in the dashboard nav, a card in the blog's footer ---------- */
  // Saved in the Settings zone like the Björn tab, so it's live as soon as it's posted.
  // Only the current status is kept: posting a new one replaces it
  function status() {
    // Last in Bear's first group, so Bear's own links keep their order
    const nav = document.querySelector('header nav');
    const anchor = nav?.querySelector('a[href$="/dashboard/email-list/"]') || nav?.querySelector('a[href$="/dashboard/styles/"]');
    if (!dashboardBase || !anchor || document.getElementById('hub-status-link')) return;
    const STYLES_URL = `${dashboardBase}styles/`;

    const css = document.createElement('style');
    css.textContent = `
#hub-status{width:min(560px,calc(100% - 40px));padding:0;color:var(--text-color);background:var(--background-color);border:1px solid var(--border);border-radius:var(--radius);box-shadow:0 8px 32px rgb(0 0 0/.2)}
#hub-status-link[hidden]{display:none}
#hub-status::backdrop{background:rgb(0 0 0/.3)}
@media (prefers-color-scheme:dark){#hub-status::backdrop{background:rgb(0 0 0/.5)}}
#hub-status .hs-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)}
#hub-status .hs-head h2{margin:0;font-size:1em;color:var(--heading-color)}
#hub-status .hs-body{padding:16px}
#hub-status .hs-row{display:flex;align-items:flex-start;gap:8px}
#hub-status :is(input,textarea){box-sizing:border-box;font-family:inherit;line-height:1.4;margin:0;padding:8px 10px;font-size:15px;border:1px solid var(--border);border-radius:3px}
#hub-status .hs-emoji{flex:0 0 3.25rem;width:3.25rem;font-size:18px;text-align:center}
#hub-status .hs-emoji::placeholder{opacity:.4}
#hub-status .hs-emoji:focus::placeholder{opacity:0}
#hub-status .hs-text{flex:1;min-width:0;min-height:calc(3lh + 18px);max-height:calc(6lh + 18px);resize:none;field-sizing:content}
#hub-status .hs-meta{display:flex;justify-content:space-between;gap:1rem;margin-top:8px;font-size:small;color:var(--muted)}
#hub-status .hs-hint{margin:0}
#hub-status .hs-count{flex-shrink:0;font-variant-numeric:tabular-nums}
#hub-status .hs-count.is-over{color:var(--error-color,#c0392b)}
#hub-status .hs-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:16px}
#hub-status .hs-actions button{margin:0}
#hub-status .hs-say{font-size:small;color:var(--muted)}
#hub-status.is-busy .hs-body{opacity:.6;pointer-events:none}`;
    document.head.append(css);

    const link = document.createElement('a');
    link.id = 'hub-status-link';
    link.href = STYLES_URL;
    link.setAttribute('role', 'button');
    link.textContent = 'Status';
    link.hidden = true;
    anchor.after(' ', link);

    // Shown from what this browser remembers, then checked against the theme
    // now and then: once an hour, or right away on a new device
    let known = null;
    try { known = JSON.parse(localStorage.getItem(STATUS_KEY) || 'null'); } catch {}
    link.hidden = !known?.on;
    if (!known || Date.now() - known.checked > 3600e3) {
      load().then((p) => {
        const on = p.css.includes(THEME_MARK) && readState(p.css).addons.status;
        rememberStatus(on);
        link.hidden = !on;
      }).catch(() => {});
    }

    const dialog = document.createElement('dialog');
    dialog.id = 'hub-status';
    dialog.setAttribute('aria-labelledby', 'hub-status-title');
    dialog.innerHTML = `
<div class="hs-head"><h2 id="hub-status-title">Status</h2><button type="button" class="hs-close">Close</button></div>
<form class="hs-body" method="dialog">
  <div class="hs-row">
    <input type="text" class="hs-emoji" aria-label="Emoji" placeholder="☕" autocomplete="off" spellcheck="false">
    <textarea class="hs-text" aria-label="Status" placeholder="What are you up to?" maxlength="600" rows="3" autocomplete="off"></textarea>
  </div>
  <div class="hs-meta"><p class="hs-hint">Shows in your footer, with how long ago you posted it.</p><span class="hs-count" aria-live="polite"></span></div>
  <div class="hs-actions"><button type="submit" class="hs-post">Post status</button><button type="button" class="link-button hs-clear" hidden>Clear status</button><span class="hs-say" aria-live="polite"></span></div>
</form>`;
    document.body.append(dialog);

    const $ = (sel) => dialog.querySelector(sel);
    const emojiInput = $('.hs-emoji');
    const textInput = $('.hs-text');
    const postButton = $('.hs-post');
    const clearButton = $('.hs-clear');
    const say = (text) => { $('.hs-say').textContent = text; };
    let busy = false;
    let page = null; // the Themes page as it is on the server: { css, csrf }

    async function load() {
      const res = await fetch(STYLES_URL, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(`Themes page: ${res.status}`);
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const form = doc.getElementById('styles-form');
      const field = form?.querySelector('textarea[name="custom_styles"]');
      if (!field) throw new Error('No theme CSS on the Themes page');
      return { css: field.value, csrf: form.querySelector('[name="csrfmiddlewaretoken"]')?.value || '' };
    }

    function setBusy(on) {
      busy = on;
      dialog.classList.toggle('is-busy', on);
      postButton.disabled = on;
    }

    async function open(event) {
      event.preventDefault();
      if (busy) return;
      emojiInput.value = '';
      textInput.value = '';
      count();
      clearButton.hidden = true;
      say('Loading…');
      dialog.showModal();
      setBusy(true);
      try {
        page = await load();
        if (!page.css.includes(THEME_MARK)) {
          say('Status works with the Björn theme. Apply it under Themes first.');
          page = null;
          return;
        }
        const current = readState(page.css).status;
        if (current) {
          emojiInput.value = current.emoji;
          textInput.value = current.text;
          count();
          clearButton.hidden = false;
        }
        say('');
        setBusy(false);
        textInput.focus();
      } catch (error) {
        console.error('Björn dashboard (status):', error);
        say('Couldn’t load your theme. Try again in a moment.');
      }
    }

    // Writes from the server's copy, so unpublished edits on another tab
    // are never published by accident
    async function save(next) {
      if (busy || !page) return;
      setBusy(true);
      say(next ? 'Posting…' : 'Clearing…');
      try {
        const fresh = await load();
        const state = readState(fresh.css);
        state.status = next;
        const updated = writeSettings(fresh.css, settingsBlock(state));
        const body = new URLSearchParams({ csrfmiddlewaretoken: fresh.csrf, custom_styles: updated });
        const res = await fetch(STYLES_URL, {
          method: 'POST', body, credentials: 'same-origin', headers: { 'X-CSRFToken': fresh.csrf }
        });
        if (!res.ok) throw new Error(`Save: ${res.status}`);
        page = await load();
        if (JSON.stringify(readState(page.css).status) !== JSON.stringify(next)) throw new Error('Not saved');
        // On the Themes page, the Björn tab and the CSS editor catch up
        document.dispatchEvent(new CustomEvent('hub:status', { detail: { status: next, css: page.css } }));
        clearButton.hidden = !next;
        say(next ? 'Posted ✓' : 'Cleared ✓');
        setTimeout(() => { if (dialog.open && !busy) dialog.close(); }, 900);
      } catch (error) {
        console.error('Björn dashboard (status):', error);
        say('Couldn’t save it. Try again in a moment.');
      } finally {
        setBusy(false);
      }
    }

    link.addEventListener('click', open);
    $('.hs-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('cancel', (e) => { if (busy) e.preventDefault(); });
    dialog.addEventListener('click', (e) => { if (e.target === dialog && !busy) dialog.close(); });
    dialog.addEventListener('close', () => link.focus());

    // Characters readers will see, out of 140
    const countEl = $('.hs-count');
    function count() {
      const n = statusLength(textInput.value);
      countEl.textContent = `${n}/${STATUS_MAX}`;
      countEl.classList.toggle('is-over', n > STATUS_MAX);
    }
    textInput.addEventListener('input', count);

    // One line: Enter posts, like a single field
    textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        $('.hs-body').requestSubmit();
      }
    });

    // Paste a link over selected text and it becomes [text](link), as in Bear's editor
    textInput.addEventListener('paste', (e) => {
      const url = (e.clipboardData?.getData('text/plain') || '').trim();
      const { selectionStart: a, selectionEnd: b, value } = textInput;
      if (a === b || !/^https?:\/\/\S+$/.test(url)) return;
      e.preventDefault();
      textInput.setRangeText(`[${value.slice(a, b).replace(/[[\]]/g, '')}](${url})`, a, b, 'end');
      count();
    });

    $('.hs-body').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = statusText(textInput.value);
      if (!text) { say('Write a status first.'); textInput.focus(); return; }
      if (statusLength(text) > STATUS_MAX) { say(`Keep it to ${STATUS_MAX} characters.`); textInput.focus(); return; }
      save({ emoji: oneEmoji(emojiInput.value), text, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') });
    });
    clearButton.addEventListener('click', () => save(null));
  }
})();
