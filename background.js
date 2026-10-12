// The icon is greyed out except where there is something to copy:
// YouTube videos, Google Play apps, Reddit posts, X and LinkedIn posts, Amazon products, and any other web page
const SPECIAL_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "play.google.com",
  "reddit.com", "www.reddit.com", "old.reddit.com", "new.reddit.com", "sh.reddit.com",
  "x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com",
  "linkedin.com", "www.linkedin.com",
  "www.amazon.com", "www.amazon.ca", "www.amazon.co.uk", "www.amazon.fr", "www.amazon.de", "www.amazon.es", "www.amazon.it"];
// LinkedIn posts (/posts/…-share-ID-…, /feed/update/urn:li:activity:ID) and Pulse articles (dated by their metadata)
const LINKEDIN_POST = "^https://(www\\.)?linkedin\\.com/(posts/.*[0-9]{19}|feed/update/urn:li:[a-zA-Z]+:[0-9]{19}|pulse/)";
const AMAZON_PRODUCT = "^https://www\\.amazon\\.(com|ca|co\\.uk|fr|de|es|it)/(.*/)?(dp|gp/product)/[A-Z0-9]{10}";
const X_POST = "^https://((www|mobile)\\.)?(x|twitter)\\.com/[^/]+/status/[0-9]+";
const REDDIT_POST = "^https://((www|old|new|sh)\\.)?reddit\\.com/(r/[^/]+/)?comments/[a-z0-9]+";

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
        new PageStateMatcher({ pageUrl: { urlMatches: REDDIT_POST } }),
        new PageStateMatcher({ pageUrl: { urlMatches: X_POST } }),
        new PageStateMatcher({ pageUrl: { urlMatches: AMAZON_PRODUCT } }),
        new PageStateMatcher({ pageUrl: { urlMatches: LINKEDIN_POST } }),
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

  if (/^https:\/\/((www|mobile)\.)?(x|twitter)\.com\//.test(url)) {
    return xPostLine(url);
  }

  if (/^https:\/\/(www\.)?linkedin\.com\//.test(url)) {
    const line = linkedinPostLine(url);
    if (line) return line;
    // Not a post (Pulse articles…): handled like any other page below
  }

  if (/^https:\/\/([a-z]+\.)?reddit\.com\//.test(url)) {
    const info = await runInPage(tab, readRedditPostInfo);
    if (!info) return null;
    return `${info.date || "?"} ${info.link}`;
  }

  if (/^https:\/\/www\.amazon\.[a-z.]+\//.test(url)) {
    const info = await runInPage(tab, readAmazonProductInfo);
    if (!info) return null;
    return `${info.date || "?"} ${info.link}`;
  }

  if (/^https:\/\/www\.sony\.(com|net)\/([a-z]{2}\/)?SonyInfo\/News\//i.test(url)) {
    const info = await runInPage(tab, readSonyNewsInfo);
    return `${info.date || "?"} ${titleIfNotInLink(info.title, info.link)}${info.link}`;
  }

  // Any other web page (news articles like Le Parisien…): publish date from the page metadata;
  // without one there is nothing worth copying, so the click shows ✗
  if (/^https?:\/\//.test(url)) {
    const info = await runInPage(tab, readArticleInfo);
    const date = formatDate(info.published);
    return date ? `${date} ${titleIfNotInLink(info.title, info.link)}${info.link}` : null;
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

// X (Twitter) post IDs are "snowflakes": the top bits are the creation time in ms since
// 2010-11-04 01:42:54.657 UTC, so the date needs no page access (X often requires sign-in)
function xPostLine(url) {
  const m = url.match(/^https:\/\/[^/]+\/([^/?#]+)\/status\/(\d+)/);
  if (!m) return null;
  const id = BigInt(m[2]);
  const d = new Date(Number((id >> 22n) + 1288834974657n));
  // Older posts (before November 2010) have small sequential IDs that carry no date.
  // Local date, as X shows post times in the viewer's time zone.
  const date = id < 10000000000000n ? "?"
    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${date} https://x.com/${m[1]}/status/${m[2]}`;
}

// LinkedIn post IDs (activity, share, ugcPost) also start with the creation time in ms: ID >> 22
function linkedinPostLine(url) {
  const u = new URL(url);
  const id = u.pathname.match(/(?:activity|share|ugcPost)[-:](\d{19})/)?.[1];
  if (!id) return null;
  const d = new Date(Number(BigInt(id) >> 22n));
  // Local date, as LinkedIn shows post times in the viewer's time zone
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${date} https://www.linkedin.com${u.pathname}`;
}

// Links that don't carry the title (nature.com/articles/s41598-025-97652-6, Sony press releases)
// get it in the line, made file name safe: it is kept when fewer than half of the title's
// words (4+ letters, accents removed) appear in the link's path.
function titleIfNotInLink(title, link) {
  if (!title) return "";
  const norm = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let path;
  try { path = norm(decodeURIComponent(new URL(link).pathname)); } catch (e) { path = norm(link); }
  const words = norm(title).split(/[^a-z0-9]+/).filter(w => w.length >= 4);
  const inLink = words.filter(w => path.includes(w)).length;
  return words.length && inLink / words.length >= 0.5 ? "" : cleanText(title) + " ";
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

  // The app data is one of the page's AF_initDataCallback blocks: "ds:5" when signed out, another
  // key when signed in, so take the block whose app[77][0] is this app's id. app[10] is the release
  // date (["Dec 14, 2012", [1355491348, ...]]), read from the timestamp so the page language doesn't
  // matter. Returns undefined when no block describes this app (e.g. stale page after in-page navigation).
  const releasedFrom = html => {
    for (const m of html.matchAll(/AF_initDataCallback\(\{key: 'ds:\d+'[^]*?data:([^]*?), sideChannel: \{\}\}\);/g)) {
      try {
        const app = JSON.parse(m[1])?.[1]?.[2];
        if (app?.[77]?.[0] !== id) continue;
        const ts = app[10]?.[1]?.[0];
        return ts ? new Date(ts * 1000).toISOString() : "";
      } catch (e) {}
    }
    return undefined;
  };

  // The loaded page usually has the date (instant); some regions get none for some apps, so only
  // then fetch the app page for the US, then other regions (about 1 s each)
  let released = releasedFrom([...document.scripts].map(s => s.textContent).join("\n"));
  for (const gl of ["US", "FR", "GB", "CH"]) {
    if (released) break;
    try {
      const res = await fetch(`/store/apps/details?id=${encodeURIComponent(id)}&hl=en&gl=${gl}`);
      released = releasedFrom(await res.text());
    } catch (e) {}
  }
  return { id, released: released || "" };
}

// Runs in the page (must be self-contained)
function readArticleInfo() {
  const meta = sel => document.querySelector(sel)?.content;
  // Scientific journals (Nature…) use citation_* / Dublin Core tags, sometimes as "2025/06/03"
  let published = meta('meta[property="article:published_time"]')
    || meta('meta[itemprop="datePublished"]')
    || meta('meta[name="date"]')
    || meta('meta[name="citation_publication_date"]')
    || meta('meta[name="citation_online_date"]')
    || meta('meta[name="dc.date"]')
    || meta('meta[name="DC.date"]');
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
  // Title without the site name (" | Scientific Reports", " - Le Parisien")
  const site = meta('meta[property="og:site_name"]')?.trim();
  let title = meta('meta[name="citation_title"]') || meta('meta[name="dc.title"]') || meta('meta[name="DC.title"]')
    || meta('meta[property="og:title"]') || document.title;
  title = (title || "").trim();
  if (site) title = title.replace(new RegExp(`\\s+[-|–—:]\\s+${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
  return { published: (published || "").replace(/^(\d{4})\/(\d{2})\/(\d{2})/, "$1-$2-$3"), link, title };
}

// Runs in the page (must be self-contained)
function readRedditPostInfo() {
  const id = location.pathname.match(/\/comments\/([a-z0-9]+)/i)?.[1];
  if (!id) return null;

  // New Reddit: <shreddit-post id="t3_ID" created-timestamp="2024-05-10T12:34:56.789000+0000" permalink="/r/…/comments/ID/slug/">
  // Old Reddit: <div class="thing" data-fullname="t3_ID" data-timestamp="1715344496789" data-permalink="…">
  // Matched on the post ID so a post left over from in-page navigation is never used.
  const post = document.querySelector(`shreddit-post[id="t3_${id}"]`);
  const thing = document.querySelector(`.thing[data-fullname="t3_${id}"]`);
  let created = post?.getAttribute("created-timestamp")
    || (thing?.dataset.timestamp && Number(thing.dataset.timestamp));
  if (!created) {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      const m = s.textContent.match(/"datePublished"\s*:\s*"([^"]+)"/);
      if (m) { created = m[1]; break; }
    }
  }

  // Local date, as Reddit shows post times in the viewer's time zone
  let date = "";
  const d = new Date(typeof created === "string"
    ? created.replace(/\.(\d{3})\d*/, ".$1").replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    : created);
  if (created && !isNaN(d)) {
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // Post link without the comment part, query or fragment
  const permalink = post?.getAttribute("permalink") || thing?.dataset.permalink
    || location.pathname.match(/^(\/r\/[^/]+)?\/comments\/[a-z0-9]+(\/[^/]+)?/i)[0];
  const path = permalink.match(/^(\/r\/[^/]+)?\/comments\/[a-z0-9]+(\/[^/]+)?/i)?.[0] || permalink;
  return { date, link: `https://www.reddit.com${path.replace(/\/?$/, "/")}` };
}

// Runs in the page (must be self-contained)
function readSonyNewsInfo() {
  const pad = n => String(n).padStart(2, "0");
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  // "September 29, 1998", "Sept. 29, 1998" or "1998年9月29日"
  const parse = text => {
    let m = text.match(/\b([A-Z][a-z]{2,8})\.?\s+(\d{1,2}),\s*(\d{4})\b/);
    const month = m && months.indexOf(m[1].slice(0, 3).toLowerCase());
    if (m && month >= 0) return `${m[3]}-${pad(month + 1)}-${pad(m[2])}`;
    m = text.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
    return m ? `${m[1]}-${pad(m[2])}-${pad(m[3])}` : "";
  };

  // Press releases have no date metadata: the date is the right-aligned line under the title
  // (<p class="mod_text right">September 29, 1998</p>); fall back to <time> and metadata
  let date = "";
  for (const el of document.querySelectorAll("p.mod_text.right")) {
    if ((date = parse(el.textContent))) break;
  }
  if (!date) date = document.querySelector("time[datetime]")?.getAttribute("datetime")?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
  if (!date) date = document.querySelector('meta[property="article:published_time"]')?.content?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";

  const title = (document.querySelector('meta[property="og:title"]')?.content
    || document.querySelector("h1")?.textContent || "").trim();
  return { date, title, link: location.origin + location.pathname.replace(/index\.html?$/, "") };
}

// Runs in the page (must be self-contained)
function readAmazonProductInfo() {
  const asin = location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/)?.[1];
  if (!asin) return null;

  // "Date First Available" row of the product details (table row or bullet), in the site's language:
  // "January 17, 2023", "17 Jan. 2023", "17 janvier 2023", "17. Januar 2023", "17 enero 2023"…
  const label = /Date First Available|Date de mise en ligne|Im Angebot von|Fecha de disponibilidad|Disponibile su Amazon/i;
  const months = { jan: 1, ene: 1, gen: 1, feb: 2, fév: 2, fev: 2, mar: 3, mär: 3, apr: 4, avr: 4, abr: 4,
    may: 5, mai: 5, mag: 5, jun: 6, jui: 6, giu: 6, jul: 7, lug: 7, aug: 8, aoû: 8, aou: 8, ago: 8,
    sep: 9, set: 9, oct: 10, okt: 10, ott: 10, nov: 11, dec: 12, déc: 12, dez: 12, dic: 12 };
  const month = word => {
    const w = word.toLowerCase();
    if (w.startsWith("juil")) return 7;                  // French juin / juillet
    return months[w.slice(0, 3)];
  };
  const pad = n => String(n).padStart(2, "0");
  const parse = text => {
    let m = text.match(/([A-Za-zÀ-ÿ]{3,})\.?\s+(\d{1,2}),\s*(\d{4})/);      // January 17, 2023
    if (m && month(m[1])) return `${m[3]}-${pad(month(m[1]))}-${pad(m[2])}`;
    m = text.match(/(\d{1,2})\.?\s+(?:de\s+)?([A-Za-zÀ-ÿ]{3,})\.?\s+(?:de\s+)?(\d{4})/); // 17 Jan. 2023, 17. Januar 2023, 17 de enero de 2023
    if (m && month(m[2])) return `${m[3]}-${pad(month(m[2]))}-${pad(m[1])}`;
    return "";
  };
  let date = "";
  for (const row of document.querySelectorAll("#prodDetails tr, #productDetails_detailBullets_sections1 tr, #detailBullets_feature_div li, #productDetails_feature_div tr")) {
    const text = row.textContent.replace(/[\u200e\u200f]/g, "");
    if (label.test(text) && (date = parse(text.replace(label, "")))) break;
  }
  // Without it, the oldest review shown on the page ("Reviewed in the United States on February 9, 2026"):
  // the product was on sale by then at the latest
  if (!date) {
    const reviews = [...document.querySelectorAll('[data-hook="review-date"]')].map(el => parse(el.textContent)).filter(Boolean);
    date = reviews.sort()[0] || "";
  }

  // Canonical link (with the product name), without query parameters
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  const link = canonical && canonical.includes(`/dp/${asin}`) ? canonical.split("?")[0] : `${location.origin}/dp/${asin}`;
  return { date, link: link.replace(/\/?$/, "/") };
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
