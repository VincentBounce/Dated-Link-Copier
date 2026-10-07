// The icon is greyed out except where there is something to copy:
// YouTube videos, Google Play apps, and any other web page
const SPECIAL_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "play.google.com"];

// Chrome only draws a disabled action in grey on pages the extension can't access, and
// activeTab makes every web page accessible: the default icon is therefore a grey copy,
// and matching pages get the colored one back through SetIcon.
async function setUpIconState() {
  const { PageStateMatcher, SetIcon, ShowAction, onPageChanged } = chrome.declarativeContent;
  chrome.action.disable();
  const imageData = {};
  for (const size of [16, 32]) imageData[size] = await loadImageData(`icons/icon-${size}.png`, size);
  onPageChanged.removeRules(undefined, () => {
    onPageChanged.addRules([{
      conditions: [
        new PageStateMatcher({ pageUrl: { urlMatches: "^https://(www|m)\\.youtube\\.com/(watch\\?|shorts/)" } }),
        new PageStateMatcher({ pageUrl: { hostEquals: "play.google.com", pathEquals: "/store/apps/details" } }),
        new PageStateMatcher({ pageUrl: { urlMatches: anyHostExcept(SPECIAL_HOSTS) } })
      ],
      actions: [new ShowAction(), new SetIcon({ imageData })]
    }]);
  });
}

async function loadImageData(path, size) {
  const bitmap = await createImageBitmap(await (await fetch(chrome.runtime.getURL(path))).blob());
  const ctx = new OffscreenCanvas(size, size).getContext("2d");
  ctx.drawImage(bitmap, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

// Rules can't exclude sites and their regexes have no lookahead, so build a regex matching
// every http(s) URL whose host is not in the list: for each prefix of an excluded host,
// accept a host that ends there or continues with a different character.
function anyHostExcept(hosts) {
  const H = "[^/:?#]";
  const esc = str => str.replace(/\./g, "\\.");
  const alts = [];
  const prefixes = new Set([""]);
  for (const h of hosts) for (let i = 1; i <= h.length; i++) prefixes.add(h.slice(0, i));
  for (const p of prefixes) {
    const next = new Set(hosts.filter(h => h.startsWith(p) && h.length > p.length).map(h => h[p.length]));
    if (p && !hosts.includes(p)) alts.push(esc(p));
    alts.push(esc(p) + "[^" + esc([...next].join("")) + "/:?#]" + H + "*");
  }
  return "^https?://(" + alts.join("|") + ")([/:?#]|$)";
}

chrome.runtime.onInstalled.addListener(setUpIconState);
chrome.runtime.onStartup.addListener(setUpIconState);

// The code is injected on click (no static content script), so it works even when
// the page was reached through in-page navigation or after an extension reload.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const str = await buildLine(tab);
    if (!str) return flashBadge(tab.id, "✗", "#d93025");

    // Isolated world: clipboardWrite permission allows the execCommand fallback there
    const [{ result: copied }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: copyToClipboard,
      args: [str]
    });
    flashBadge(tab.id, copied ? "✓" : "✗", copied ? "#188038" : "#d93025");
  } catch (e) {
    console.error(e);
    flashBadge(tab.id, "✗", "#d93025");
  }
});

async function runInPage(tab, func, world = "ISOLATED") {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world, func });
  return result;
}

// One line per kind of page; "?" when the date isn't found
async function buildLine(tab) {
  const url = tab.url || "";

  if (/^https:\/\/(www|m)\.youtube\.com\//.test(url)) {
    // MAIN world: gives access to the YouTube player's data for the current video
    const info = await runInPage(tab, readVideoInfo, "MAIN");
    if (!info) return null;
    // Replace " - " in channels and title; one "@" per channel (collaborations have several)
    const cleanChannels = info.channels.map(c => "@" + cleanText(c)).join(" ");
    const cleanTitle = cleanText(info.title);
    return `${formatDate(info.published)} ${cleanChannels} - ${cleanTitle} https://youtu.be/${info.id}`;
  }

  if (/^https:\/\/play\.google\.com\/store\/apps\/details\?/.test(url)) {
    const info = await runInPage(tab, readPlayAppInfo);
    if (!info) return null;
    return `Android ${formatDate(info.released) || "?"} https://play.google.com/store/apps/details?id=${info.id}`;
  }

  // Any other web page (news articles like Le Parisien…): publish date from the page metadata;
  // without one there is nothing worth copying, so the click shows ✗
  if (/^https?:\/\//.test(url)) {
    const info = await runInPage(tab, readArticleInfo);
    const date = formatDate(info.published);
    return date ? `${date} ${info.link}` : null;
  }

  return null;
}

function flashBadge(tabId, text, color) {
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 1500);
}

// Characters forbidden in file names -> full-width look-alikes that are allowed
const FILENAME_SAFE = { "\\": "＼", "/": "／", ":": "：", "*": "＊", "?": "？", '"': "＂", ">": "＞", "<": "＜", "|": "｜" };

function cleanText(s) {
  return s.replace(/ - /g, ", ").replace(/[\\/:*?"<>|]/g, ch => FILENAME_SAFE[ch]);
}

// "2005-04-23T20:31:52-07:00" -> "2005-04-23", the date YouTube displays
// (converting to local time could shift it by one day)
function formatDate(s) {
  return (s || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
}

// Runs in the page (must be self-contained)
async function readVideoInfo() {
  const url = new URL(location.href);
  const id = url.searchParams.get("v") || (url.pathname.match(/^\/shorts\/([^/?]+)/) || [])[1];
  if (!id) return null;

  // Only accept player data whose videoId matches the URL, so we never copy the previous video
  const findResponse = () => {
    for (const p of document.querySelectorAll("#movie_player, #shorts-player")) {
      const r = typeof p.getPlayerResponse === "function" ? p.getPlayerResponse() : null;
      if (r?.videoDetails?.videoId === id) return r;
    }
    const r = window.ytInitialPlayerResponse;
    return r?.videoDetails?.videoId === id ? r : null;
  };

  // Right after navigating to a new video, the player may need a moment to update
  let resp = findResponse();
  for (let i = 0; i < 15 && !resp; i++) {
    await new Promise(r => setTimeout(r, 200));
    resp = findResponse();
  }

  const micro = resp?.microformat?.playerMicroformatRenderer;
  const channel = resp?.videoDetails?.author || micro?.ownerChannelName
    || document.querySelector("#owner ytd-channel-name a")?.innerText?.trim() || "";

  // Collaborations: the player only knows the main channel, the full list is in the
  // "Collaborators" dialog data of the owner block under the video
  const findCollaborators = () => {
    const owner = document.querySelector("ytd-watch-metadata ytd-video-owner-renderer");
    const items = owner?.data?.navigationEndpoint?.showDialogCommand?.panelLoadingStrategy
      ?.inlineContent?.dialogViewModel?.customContent?.listViewModel?.listItems;
    const names = (items || []).map(i => i.listItemViewModel?.title?.content?.trim()).filter(Boolean);
    // Must contain the main channel, otherwise it's leftover data from the previous video
    return names.length > 1 && names.includes(channel) ? names : null;
  };
  // Wait until the page below the player shows this video (not needed on /shorts/)
  const flexy = document.querySelector("ytd-watch-flexy");
  for (let i = 0; i < 10 && url.pathname === "/watch" && flexy?.getAttribute("video-id") !== id; i++) {
    await new Promise(r => setTimeout(r, 200));
  }
  const channels = findCollaborators() || [channel];

  return {
    id,
    title: resp?.videoDetails?.title
      || document.querySelector("ytd-watch-metadata h1")?.innerText?.trim() || "",
    channels,
    published: micro?.publishDate || micro?.uploadDate || ""
  };
}

// Runs in the page (must be self-contained)
async function readPlayAppInfo() {
  const id = new URL(location.href).searchParams.get("id");
  if (!id) return null;

  // The app data is the "ds:5" block of the page; app[10] is the release date
  // (["Dec 14, 2012", [1355491348, ...]]), read from the timestamp so the page language doesn't matter.
  // Returns undefined when the block is missing or belongs to another app (in-page navigation).
  const releasedFrom = (html, checkId) => {
    const m = html.match(/key: 'ds:5'[^]*?data:([^]*?), sideChannel: \{\}\}\);/);
    if (!m) return undefined;
    try {
      const app = JSON.parse(m[1])[1][2];
      if (checkId && app[77]?.[0] !== id) return undefined;
      const ts = app[10]?.[1]?.[0];
      return ts ? new Date(ts * 1000).toISOString() : "";
    } catch (e) {
      return undefined;
    }
  };

  const inline = [...document.scripts].map(s => s.textContent).find(t => t.includes("key: 'ds:5'"));
  let released = inline && releasedFrom(inline, true);
  if (!released) {
    // Fall back to fetching this app's page: after in-page navigation the inline block is stale,
    // and some regions (e.g. France) get no release date for some apps while the US gets it
    try {
      const res = await fetch(`/store/apps/details?id=${encodeURIComponent(id)}&hl=en&gl=US`);
      released = releasedFrom(await res.text(), false);
    } catch (e) {}
  }
  return { id, released: released || "" };
}

// Runs in the page (must be self-contained)
function readArticleInfo() {
  const meta = sel => document.querySelector(sel)?.content;
  let published = meta('meta[property="article:published_time"]')
    || meta('meta[itemprop="datePublished"]')
    || meta('meta[name="date"]');
  if (!published) {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      const m = s.textContent.match(/"datePublished"\s*:\s*"([^"]+)"/);
      if (m) { published = m[1]; break; }
    }
  }

  // Canonical link if it's on the same site, otherwise the current URL without tracking parameters
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  let link;
  if (canonical && new URL(canonical).hostname === location.hostname) {
    link = canonical;
  } else {
    const u = new URL(location.href);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/^(utm_.*|fbclid|gclid)$/.test(k)) u.searchParams.delete(k);
    }
    link = u.href;
  }
  return { published: published || "", link };
}

// Runs in the page's isolated world (must be self-contained)
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {}

  // Fallback that doesn't need page focus
  const prev = document.activeElement;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) {}
  ta.remove();
  prev?.focus?.();

  if (!ok) prompt("Copy manually", text);
  return ok;
}
