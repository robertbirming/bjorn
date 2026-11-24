/*
 Plugin name: Björn
 Description: The one line for both your blog footer and your dashboard. It never changes,
 so a cached copy is never out of date: it only loads the right version of Björn.
 On the blog: the add-ons script matching your theme. In the dashboard: the newest dashboard script.
 Author: Robert Birming
 Author URI: https://robertbirming.com
*/
(() => {
  "use strict";

  // Never write Bear's double-brace tags in this file, not even in a comment

  const REPO = "robertbirming/bjorn";
  const CHANNEL = "0"; // 1 from launch
  const cdn = (version) => `https://cdn.jsdelivr.net/gh/${REPO}@${version}/`;
  const valid = (v) => /^\d+\.\d+\.\d+$/.test(v || "") && v.split(".")[0] === CHANNEL;
  const newer = (a, b) => {
    const x = a.split(".").map(Number);
    const y = (b || "0.0.0").split(".").map(Number);
    for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
  };

  // Loads a script, and the channel's copy if that fails
  function load(file, version) {
    const script = document.createElement("script");
    script.src = cdn(version) + file;
    if (version !== CHANNEL) script.onerror = () => load(file, CHANNEL);
    (document.body || document.head).append(script);
  }

  // The newest release: GitHub knows at once, jsDelivr's lookup can lag.
  // Asked at most every ten minutes, and never older than one seen before
  async function newest() {
    let seen = null;
    try {
      seen = JSON.parse(localStorage.getItem("hub-latest") || "null");
      if (seen && Date.now() - seen.at < 600e3 && valid(seen.version)) return seen.version;
    } catch {}
    let version = null;
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
      if (res.ok) version = String((await res.json()).tag_name || "").replace(/^v/, "");
    } catch {}
    if (!valid(version)) {
      try {
        const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${REPO}/resolved?specifier=${CHANNEL}`);
        if (res.ok) version = (await res.json()).version;
      } catch {}
    }
    if (seen && valid(seen.version) && (!valid(version) || newer(seen.version, version))) version = seen.version;
    if (!valid(version)) return CHANNEL;
    try { localStorage.setItem("hub-latest", JSON.stringify({ version, at: Date.now() })); } catch {}
    return version;
  }

  if (/^\/[^/]+\/dashboard\//.test(location.pathname)) {
    newest().then((version) => load("dashboard.js", version));
  } else {
    // The theme says which Björn it is
    const theme = getComputedStyle(document.documentElement)
      .getPropertyValue("--bjorn-version").trim().replace(/^["']|["']$/g, "");
    load("hub.js", valid(theme) ? theme : CHANNEL);
  }
})();
