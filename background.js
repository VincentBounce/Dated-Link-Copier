// The icon is greyed out except where there is something to copy:
// YouTube videos and channels, Google Play apps, Reddit posts and subreddits, X posts and profiles, LinkedIn posts,
// Amazon products, and any other web page (TikTok, Instagram, Threads, Bluesky, Mastodon, GitHub, GitLab, Wikipedia,
// npm, Steam, Meta Quest, Microsoft Store, Firefox and Edge add-ons, Flathub…)
const SPECIAL_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "play.google.com",
  "reddit.com", "www.reddit.com", "old.reddit.com", "new.reddit.com", "sh.reddit.com",
  "x.com", "www.x.com", "mobile.x.com", "twitter.com", "www.twitter.com", "mobile.twitter.com",
  "linkedin.com", "www.linkedin.com",
  "www.amazon.com", "www.amazon.ca", "www.amazon.co.uk", "www.amazon.fr", "www.amazon.de", "www.amazon.es", "www.amazon.it"];
// LinkedIn posts (/posts/…-share-ID-…, /feed/update/urn:li:activity:ID) and Pulse articles (dated by their metadata)
const LINKEDIN_POST = "^https://(www\\.)?linkedin\\.com/(posts/.*[0-9]{19}|feed/update/urn:li:[a-zA-Z]+:[0-9]{19}|pulse/)";
const AMAZON_PRODUCT = "^https://www\\.amazon\\.(com|ca|co\\.uk|fr|de|es|it)/(.*/)?(dp|gp/product)/[A-Z0-9]{10}";
// Channels and their tabs (/@handle/videos, /channel/UC…)
const YOUTUBE_CHANNEL = "^https://(www|m)\\.youtube\\.com/(@[^/?#]+|(channel|c|user)/[^/?#]+)";
const X_POST = "^https://((www|mobile)\\.)?(x|twitter)\\.com/[^/]+/status/[0-9]+";
// Profiles; also lights /home, /explore… (no exclusion in rules), where nothing is copied
const X_PROFILE = "^https://((www|mobile)\\.)?(x|twitter)\\.com/[A-Za-z0-9_]{1,15}/?([?#].*)?$";
const REDDIT_POST = "^https://((www|old|new|sh)\\.)?reddit\\.com/(r/[^/]+/)?comments/[a-z0-9]+";
// Subreddits, with their sort tabs (/r/apple/new/)
const REDDIT_SUBREDDIT = "^https://((www|old|new|sh)\\.)?reddit\\.com/r/[A-Za-z0-9_]+/?((hot|new|top|rising|controversial)/?)?([?#].*)?$";

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
        new PageStateMatcher({ pageUrl: { urlMatches: YOUTUBE_CHANNEL } }),
        new PageStateMatcher({ pageUrl: { hostEquals: "play.google.com", pathEquals: "/store/apps/details" } }),
        new PageStateMatcher({ pageUrl: { urlMatches: REDDIT_POST } }),
        new PageStateMatcher({ pageUrl: { urlMatches: REDDIT_SUBREDDIT } }),
        new PageStateMatcher({ pageUrl: { urlMatches: X_POST } }),
        new PageStateMatcher({ pageUrl: { urlMatches: X_PROFILE } }),
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
    const str = readableLinks(await buildLine(tab) || "");
    if (!str) return flashBadge(tab.id, "✗", "#d93025");

    const copied = await writeClipboard(str);
    flashBadge(tab.id, copied ? "✓" : "✗", copied ? "#188038" : "#d93025");
  } catch (e) {
    console.error(e);
    flashBadge(tab.id, "✗", "#d93025");
  }
});

// Links as the address bar shows them: percent-encoded UTF-8 decoded ("clean-link-—-copy" instead of
// "clean-link-%E2%80%94-copy"); ASCII (%20, %2F, %3F…), spaces and control characters stay encoded, so the
// link keeps its meaning and still ends at the first space of the line
function readableLinks(line) {
  return line.replace(/(%[0-9A-F]{2})+/gi, run => {
    let text;
    try { text = decodeURIComponent(run); } catch (e) { return run; }
    return text.replace(/[\x00-\x7F\s\p{C}]/gu, c =>
      [...new TextEncoder().encode(c)].map(b => "%" + b.toString(16).toUpperCase().padStart(2, "0")).join(""));
  });
}

// The service worker has no DOM: the line goes to the clipboard through an offscreen document,
// which also works on pages no extension may script (Chrome Web Store)
async function writeClipboard(text) {
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["CLIPBOARD"], justification: "Copy the dated line" });
  }
  return chrome.runtime.sendMessage({ type: "copy", text });
}

async function runInPage(tab, func, world = "ISOLATED", args = []) {
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world, func, args });
  return result;
}

// One line per kind of page; "?" when the date isn't found
async function buildLine(tab) {
  const url = tab.url || "";

  if (/^https:\/\/(www|m)\.youtube\.com\//.test(url)) {
    // Channels: date joined, written in the page's language
    if (new RegExp(YOUTUBE_CHANNEL).test(url)) {
      const info = await runInPage(tab, readYouTubeChannelInfo);
      return `${localizedDate(info.joined, info.lang) || "?"} ${info.link}`;
    }
    // MAIN world: gives access to the YouTube player's data for the current video
    const info = await runInPage(tab, readVideoInfo, "MAIN");
    if (!info) return null;
    // Replace " - " in channels and title; one "@" per channel (collaborations have several)
    const cleanChannels = info.channels.map(c => "@" + cleanText(c)).join(" ");
    const cleanTitle = cleanText(info.title);
    return `${formatDate(info.published)} ${cleanChannels} - ${cleanTitle} https://youtu.be/${info.id}`;
  }

  if (/^https:\/\/play\.google\.com\/store\/apps\/details\?/.test(url)) {
    // The loaded page usually has the date (instant); some apps have none in any region (com.anthropic.aibo),
    // so then Chrome-Stats (~0.1 s), and last the app page for other regions (about 1 s each)
    const info = await runInPage(tab, readPlayAppInfo, "ISOLATED", [false]);
    if (!info) return null;
    const date = formatDate(info.released) || await chromeStatsDate(info.id)
      || formatDate((await runInPage(tab, readPlayAppInfo, "ISOLATED", [true]))?.released);
    return `Android ${date || "?"} https://play.google.com/store/apps/details?id=${info.id}`;
  }

  // Chrome Web Store and Edge Add-ons items: release date from Chrome-Stats, which follows both. The stores show only
  // the last update, and Chrome blocks extensions from its Store's pages and requests (its own data has the first
  // publication time, out of reach)
  const store = url.match(/^https:\/\/(chromewebstore\.google\.com\/detail|microsoftedge\.microsoft\.com\/addons\/detail)\/([^/?#]+\/)?([a-p]{32})([/?#]|$)/);
  if (store) {
    const browser = store[1].startsWith("chrome") ? "Chrome" : "Edge";
    return `${browser} ext ${await chromeStatsDate(store[3]) || "?"} https://${store[1]}/${store[2] || ""}${store[3]}`;
  }

  // Steam games: platforms and release date, like App Store apps
  if (/^https:\/\/store\.steampowered\.com\/app\/\d+/.test(url)) {
    const info = await runInPage(tab, readSteamAppInfo);
    const platforms = ["windows", "mac", "linux"].filter(p => info.platforms[p])
      .map(p => ({ windows: "Windows", mac: "macOS", linux: "Linux" })[p]).join("-");
    return `${platforms || "?"} ${localizedDate(info.date, "en") || "?"} ${info.link}`;
  }

  // Meta Quest Store apps: release date shown in the page's language
  if (/^https:\/\/www\.meta\.com\/([a-z]{2}-[a-z]{2}\/)?experiences\/([^/?#]+\/)?\d+/.test(url)) {
    const info = await runInPage(tab, readMetaQuestAppInfo);
    return `Meta Quest ${localizedDate(info.date, info.lang) || "?"} ${info.link}`;
  }

  // Flathub apps: date added to Flathub
  if (/^https:\/\/flathub\.org\/([a-z]{2}([-_][A-Za-z]{2,4})?\/)?apps\/[A-Za-z0-9._-]+/.test(url)) {
    const info = await runInPage(tab, readFlathubAppInfo);
    return `Linux ${info.added ? new Date(info.added * 1000).toISOString().slice(0, 10) : "?"} ${info.link}`;
  }

  // Microsoft Store apps and games: release date
  if (/^https:\/\/apps\.microsoft\.com\/detail\/[a-z0-9]{12}/i.test(url)) {
    const info = await runInPage(tab, readMicrosoftStoreInfo);
    return `Windows ${formatDate(info.released) || "?"} ${info.link}`;
  }

  // Chrome-Stats pages (chrome-stats.com/d/<id>: Android apps, browser extensions…): release date and link, no title
  if (/^https:\/\/chrome-stats\.com\//.test(url)) {
    const info = await runInPage(tab, readChromeStatsInfo);
    if (info) return `${info.date || "?"} ${info.link}`;
    // Not an app or extension page: handled like any other page below
  }

  // App Store apps (apps.apple.com/<country>/app/<name>/id<id>): compatible platforms and first release date
  if (/^https:\/\/apps\.apple\.com\/([a-z]{2}\/)?app\/([^/]+\/)?id\d+/.test(url)) {
    const info = await runInPage(tab, readAppStoreInfo);
    if (info) return `${info.platforms.join("-") || "?"} ${info.date || "?"} ${info.link}`;
  }

  if (/^https:\/\/((www|mobile)\.)?(x|twitter)\.com\//.test(url)) {
    if (/\/status\/\d+/.test(url)) return xPostLine(url);
    // Profiles (x.com/<user>): month joined, the day isn't shown
    const info = await runInPage(tab, readXProfileInfo);
    const date = info && localizedDate(info.joined, info.lang);
    return date ? `${date} https://x.com/${info.user}` : null;
  }

  // TikTok videos, Instagram and Threads posts, Bluesky posts: dated by their ID, like X and LinkedIn
  const idLine = await idPostLine(url, tab);
  if (idLine) return idLine;

  if (/^https:\/\/(www\.)?linkedin\.com\//.test(url)) {
    const line = linkedinPostLine(url);
    if (line) return line;
    // Not a post (Pulse articles…): handled like any other page below
  }

  if (/^https:\/\/([a-z]+\.)?reddit\.com\//.test(url)) {
    const info = await runInPage(tab, readRedditInfo);
    if (!info) return null;
    return `${info.date || "?"} ${info.link}`;
  }

  if (/^https:\/\/www\.amazon\.[a-z.]+\//.test(url)) {
    const info = await runInPage(tab, readAmazonProductInfo);
    if (!info) return null;
    return `${info.date || "?"} ${info.link}`;
  }

  if (/^https:\/\/news\.ycombinator\.com\/item\?/.test(url)) {
    const info = await runInPage(tab, readHackerNewsItemInfo);
    if (!info) return null;
    return `${info.date || "?"} ${titleIfNotInLink(info.title, info.link)}${info.link}`;
  }

  if (/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+/.test(url)) {
    const info = await runInPage(tab, readPubMedInfo);
    if (!info) return null;
    return `${info.date || "?"} ${titleIfNotInLink(info.title, info.link)}${info.link}`;
  }

  // SoundCloud tracks (soundcloud.com/<user>/<track>): publish date and link
  if (/^https:\/\/soundcloud\.com\/[^/?#]+\/[^/?#]+/.test(url)) {
    const info = await runInPage(tab, readSoundCloudTrackInfo);
    if (info) return `${info.date || "?"} ${info.link}`;
    // Not a track (sets, likes…): handled like any other page below
  }

  // Pouët demoscene productions: like YouTube, "date @group - name link", one "@" per group
  if (/^https:\/\/www\.pouet\.net\/prod\.php\?/.test(url)) {
    const info = await runInPage(tab, readPouetProdInfo);
    if (!info) return null;
    const groups = info.groups.map(g => "@" + cleanText(g)).join(" ");
    return `${info.date || "?"} ${groups ? `${groups} - ` : ""}${cleanText(info.name)} ${info.link}`;
  }

  // Suno songs: like YouTube, "date @artist - title link"; the share link (/s/<code>) is kept
  if (/^https:\/\/suno\.com\/song\/[0-9a-f-]{36}/.test(url)) {
    const info = await runInPage(tab, readSunoSongInfo);
    const who = info.handle ? `@${cleanText(info.handle)} - ` : "";
    return `${info.date || "?"} ${who}${cleanText(info.title)} ${info.link}`;
  }

  // Shadertoy shaders: upload date and shader name (the link only has the ID)
  if (/^https:\/\/www\.shadertoy\.com\/view\/\w+/.test(url)) {
    const info = await runInPage(tab, readShadertoyInfo, "MAIN");
    return `${info.date || "?"} ${titleIfNotInLink(info.title, info.link)}${info.link}`;
  }

  // iCloud shared shortcuts: creation date and name (the link only has the ID)
  if (/^https:\/\/www\.icloud\.com\/shortcuts\/[0-9a-f]{32}/.test(url)) {
    const info = await runInPage(tab, readICloudShortcutInfo);
    return `${info.created ? localDate(info.created) : "?"} ${titleIfNotInLink(info.name, info.link)}${info.link}`;
  }

  // GitHub and GitLab repositories, issues, pull or merge requests, commits; Wikipedia articles; npm packages;
  // Firefox add-ons: public APIs
  const apiLine = await forgeLine(url) || await wikipediaLine(url) || await npmLine(url) || await firefoxAddonLine(url);
  if (apiLine) return apiLine;

  // Apple user guides (support.apple.com/<locale>/guide/…) carry no date at all: the date read, and the link without
  // the locale (support.apple.com serves the reader's)
  const appleGuide = url.match(/^https:\/\/support\.apple\.com\/(?:[a-z]{2}-[a-z0-9]{2,4}\/)?(guide\/[^?#]+)/);
  if (appleGuide) return `${consultedDate()} https://support.apple.com/${appleGuide[1]}`;

  // GitHub releases: publication date, shown in the viewer's time zone
  if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/tag\/[^/?#]+/.test(url)) {
    const info = await runInPage(tab, readGitHubReleaseInfo);
    return `${info.published ? localDate(Date.parse(info.published)) : "?"} ${info.link}`;
  }

  // PyPI projects: date of the first release
  if (/^https:\/\/pypi\.org\/project\/[^/?#]+/.test(url)) {
    const info = await runInPage(tab, readPyPIProjectInfo);
    return `${info.date || "?"} ${info.link}`;
  }

  // Have I Been Pwned breaches: date the breach was added to HIBP ("Added to HIBP: 20 Dec 2020")
  if (/^https:\/\/haveibeenpwned\.com\/Breach\/[^/?#]+/i.test(url)) {
    const info = await runInPage(tab, readHibpBreachInfo);
    return `${info.date || "?"} ${info.link}`;
  }

  // Y Combinator company pages: founding year ("Founded: 2023"), as "2023-xx-xx"
  if (/^https:\/\/www\.ycombinator\.com\/companies\/[^/?#]+/.test(url)) {
    const info = await runInPage(tab, readYCCompanyInfo);
    return `${info.year ? `${info.year}-xx-xx` : "?"} ${info.link}`;
  }

  // ScienceDirect Topics pages compile excerpts and have no date of their own: use the year of the
  // source their definition is based on, as "2022-xx-xx"
  if (/^https:\/\/www\.sciencedirect\.com\/topics\//.test(url)) {
    const info = await runInPage(tab, readScienceDirectTopicInfo);
    return `${info.year ? `${info.year}-xx-xx` : "?"} ${info.link}`;
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
  return s.trim().replace(/ - /g, ", ").replace(/[\\/:*?"<>|]/g, ch => FILENAME_SAFE[ch]);
}

// X (Twitter) post IDs are "snowflakes": the top bits are the creation time in ms since
// 2010-11-04 01:42:54.657 UTC, so the date needs no page access (X often requires sign-in)
function xPostLine(url) {
  const m = url.match(/^https:\/\/[^/]+\/([^/?#]+)\/status\/(\d+)/);
  if (!m) return null;
  const id = BigInt(m[2]);
  // Older posts (before November 2010) have small sequential IDs that carry no date.
  // Local date, as X shows post times in the viewer's time zone.
  const date = id < 10000000000000n ? "?" : localDate(Number((id >> 22n) + 1288834974657n));
  return `${date} https://x.com/${m[1]}/status/${m[2]}`;
}

// X profiles show "Joined October 2021" (in the page's language) and no date metadata
function readXProfileInfo() {
  const user = location.pathname.match(/^\/([A-Za-z0-9_]{1,15})(\/|$)/)?.[1];
  // The title "Name (@user) / X" follows in-page navigation: it tells this is that profile's page
  if (!user || !document.title.toLowerCase().includes(`(@${user.toLowerCase()})`)) return null;
  // The "Joined" line: data-testid="UserJoinDate" when signed in, the line with the calendar icon when signed out
  const joined = (document.querySelector('[data-testid="UserJoinDate"]')
    || document.querySelector('svg[data-icon="icon-calendar"]')?.parentElement)?.textContent || "";
  return { joined, lang: document.documentElement.lang || "en", user };
}

// A date written in a page's language: "Joined October 2021", "Actif depuis le 21 mars 2008", "Joined Mar 21, 2008",
// "2008年3月21日" -> "2008-03-21", "2021-10-xx" without day, "" without year and month. Month names come from Intl
// in that language, long and short; the longest one found wins (Japanese "11月" isn't "1月").
function localizedDate(text, lang) {
  const pad = n => String(n).padStart(2, "0");
  const t = text.toLowerCase();
  const ymd = t.match(/((?:19|20)\d\d)\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})\D/);   // year first: 2008年3月21日, 2008. 3. 21.
  if (ymd) return `${ymd[1]}-${pad(ymd[2])}-${pad(ymd[3])}`;
  const year = t.match(/\b(?:19|20)\d\d\b/)?.[0];
  let format;
  try { format = style => new Intl.DateTimeFormat(lang, { month: style }); format("long"); } catch (e) { format = style => new Intl.DateTimeFormat("en", { month: style }); }
  let month = 0, name = "";
  for (const style of ["long", "short"]) {
    for (let m = 0; m < 12; m++) {
      const n = format(style).format(new Date(2000, m, 1)).toLowerCase().replace(/\.$/, "");
      if (t.includes(n) && n.length > name.length) { month = m + 1; name = n; }
    }
  }
  if (!month) {
    const dmy = t.match(/\b(\d{1,2})[./](\d{1,2})[./]((?:19|20)\d\d)\b/);   // no name: day first, 21.03.2008
    return dmy ? `${dmy[3]}-${pad(dmy[2])}-${pad(dmy[1])}` : "";
  }
  if (!year) return "";
  const day = t.replace(year, "").replace(name, "").match(/\b(\d{1,2})\b/)?.[1];
  return `${year}-${pad(month)}-${day && day >= 1 && day <= 31 ? pad(day) : "xx"}`;
}

// LinkedIn post IDs (activity, share, ugcPost) also start with the creation time in ms: ID >> 22
function linkedinPostLine(url) {
  const u = new URL(url);
  const id = u.pathname.match(/(?:activity|share|ugcPost)[-:](\d{19})/)?.[1];
  if (!id) return null;
  // Local date, as LinkedIn shows post times in the viewer's time zone
  const date = localDate(Number(BigInt(id) >> 22n));
  return `${date} https://www.linkedin.com${u.pathname}`;
}

// Post IDs that carry their creation time, so the date needs no page access (these sites often require
// sign-in). Local date, as the sites show times in the viewer's time zone. Checked on real posts:
// - TikTok /@user/video/<id> (also /photo/): id >> 32 = Unix seconds
// - Instagram /p/<code>/, /reel/<code>/ and Threads /@user/post/<code>: the code is the media ID in base 64
//   (A-Z a-z 0-9 - _), whose top bits are ms since 2011-08-24 21:07:01.721 UTC: (id >> 23) + 1314220021721;
//   older posts have small sequential IDs that carry no date
// - Bluesky /profile/<handle>/post/<rkey>: the rkey is a TID, 13 base-32 digits (2-7 a-z), microseconds >> 10
// - Mastodon <server>/@user/<id>: id >> 16 = ms
async function idPostLine(url, tab) {
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, "");
  const digits = (code, alphabet) => [...code].reduce((n, c) => n * BigInt(alphabet.length) + BigInt(alphabet.indexOf(c)), 0n);
  let m;
  if (host === "tiktok.com" && (m = u.pathname.match(/^\/(@[^/]+)\/(video|photo)\/(\d{19})/))) {
    return `${localDate(Number(BigInt(m[3]) >> 32n) * 1000)} https://www.tiktok.com/${m[1]}/${m[2]}/${m[3]}`;
  }
  const instagram = host === "instagram.com" && u.pathname.match(/^\/(?:([^/]+)\/)?(p|reels?|tv)\/([A-Za-z0-9_-]{1,11})\/?$/);
  const threads = /^threads\.(com|net)$/.test(host) && u.pathname.match(/^\/(@[^/]+)\/post\/([A-Za-z0-9_-]{1,11})\/?$/);
  if (instagram || threads) {
    const code = instagram ? instagram[3] : threads[2];
    const id = digits(code, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_");
    const date = id < 1n << 40n ? "?" : localDate(Number((id >> 23n) + 1314220021721n));
    if (threads) return `${date} https://www.threads.com/${threads[1]}/post/${code}`;
    // Instagram links rarely name the creator: "date @user link" like YouTube
    const user = instagram[1] || await runInPage(tab, readInstagramUser, "ISOLATED", [code]);
    return `${date} ${user ? `@${user} ` : ""}https://www.instagram.com/${instagram[2].replace("reels", "reel")}/${code}/`;
  }
  // Mastodon posts on any server (/@user/<id>, /@user@server/<id>): id >> 16 = ms; the oldest posts have sequential IDs
  if ((m = u.pathname.match(/^\/(@[^/]+)\/(\d{6,19})\/?$/))) {
    const id = BigInt(m[2]);
    return `${id < 1n << 40n ? "?" : localDate(Number(id >> 16n))} https://${u.hostname}/${m[1]}/${m[2]}`;
  }
  if (host === "bsky.app" && (m = u.pathname.match(/^\/profile\/([^/]+)\/post\/([^/]+)/))) {
    const date = /^[2-7a-z]{13}$/.test(m[2]) ? localDate(Number(digits(m[2], "234567abcdefghijklmnopqrstuvwxyz") >> 10n) / 1000) : "?";
    return `${date} https://bsky.app/profile/${m[1]}/post/${m[2]}`;
  }
  return null;
}

// Runs in the page (must be self-contained)
// The creator of an Instagram post is in og:url ("https://www.instagram.com/instagram/reel/<code>/"): the loaded
// page's when it is that post (in-page navigation keeps the first page's head), else the post page fetched (~0.5 s)
async function readInstagramUser(code) {
  const userOf = doc => doc.querySelector('meta[property="og:url"]')?.content
    .match(new RegExp(`^https://www\\.instagram\\.com/([^/]+)/(?:p|reels?|tv)/${code}/`))?.[1];
  let user = userOf(document);
  if (!user) {
    try { user = userOf(new DOMParser().parseFromString(await (await fetch(`/p/${code}/`)).text(), "text/html")); } catch (e) {}
  }
  return user || "";
}

// Date a page was read, for pages with no date of their own: always the month in parentheses, "(2026-10)" (the user's
// convention), so it shows at once that it is not the page's date and not to the day
function consultedDate() {
  return `(${localDate(Date.now()).slice(0, 7)})`;
}

// Time in ms -> "2025-12-15" in the viewer's time zone
function localDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
// A channel shows "Joined Mar 21, 2008" ("Actif depuis le 21 mars 2008"…) only in its About panel, whose data is in
// the /about page (fetched, ~1 s, 2-3 MB), next to the channel's canonical link (https://www.youtube.com/@mkbhd)
async function readYouTubeChannelInfo() {
  const base = location.pathname.match(/^\/(@[^/]+|(?:channel|c|user)\/[^/]+)/)[1];
  let joined = "", link = `https://www.youtube.com/${base}`, lang = "en";
  try {
    const html = await (await fetch(`/${base}/about`)).text();
    const m = html.match(/"joinedDateText":\{"content":"([^"]+)"[^]{0,200}?"canonicalChannelUrl":"([^"]+)"/);
    if (m) {
      joined = JSON.parse(`"${m[1]}"`);
      link = m[2].replace(/^http:/, "https:");
    }
    lang = html.match(/<html[^>]* lang="([^"]+)"/)?.[1] || lang;
  } catch (e) {}
  return { joined, lang, link };
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
async function readPlayAppInfo(fetchRegions) {
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

  // The loaded page, or else (fetchRegions) the app page for the US, then other regions
  let released = fetchRegions ? "" : releasedFrom([...document.scripts].map(s => s.textContent).join("\n"));
  for (const gl of fetchRegions ? ["US", "FR", "GB", "CH"] : []) {
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
  // First complete date among the usual tags. Scientific journals (Nature…) use citation_* /
  // Dublin Core tags, as "2025/06/03"; their citation_publication_date can be the print issue
  // month only ("2026/07"), so the online date comes first.
  const candidates = [
    meta('meta[property="article:published_time"]'),
    meta('meta[itemprop="datePublished"]'),
    meta('meta[name="date"]'),
    meta('meta[name="citation_online_date"]'),
    meta('meta[name="dc.date"]'),
    meta('meta[name="DC.date"]'),
    meta('meta[name="citation_publication_date"]'),
    ...[...document.querySelectorAll('script[type="application/ld+json"]')]
      .map(s => s.textContent.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1])
  ];
  const published = candidates.map(d => (d || "").trim().replace(/^(\d{4})\/(\d{2})\/(\d{2})/, "$1-$2-$3"))
    .find(d => /^\d{4}-\d{2}-\d{2}/.test(d)) || shownDate();

  // Without metadata, a date shown on the page: <time datetime>, else the text after "Publié le",
  // "Published on", "Veröffentlicht am"… ("Publié le 14.11.2021", "14 novembre 2021", "November 14, 2021"),
  // else the text of the article's date element without label (ameli.fr: <p class="date">12 août 2025</p>)
  function shownDate() {
    const iso = document.querySelector("time[datetime]")?.getAttribute("datetime")?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (iso) return iso;
    const label = /(publi[ée]e? le|mis en ligne le|published(?: on)?|posted(?: on)?|ver[öo]ffentlicht(?: am)?|pubblicato(?: il)?|publicado(?: el)?)\s*:?\s*/i;
    const m = document.body.innerText.match(new RegExp(label.source + "([^\\n]{6,40})", "i"));
    if (m) return dateFromText(m[2], /^(published|posted)/i.test(m[1]));
    const element = document.querySelector("article .date") || document.querySelector(".date");
    return element ? dateFromText(element.textContent.trim(), false) : "";
  }

  // "14.11.2021" (day first, or month first after an English label with slashes), "14 novembre 2021", "November 14, 2021"
  function dateFromText(text, english) {
    const pad = n => String(n).padStart(2, "0");
    const months = { jan: 1, ene: 1, gen: 1, fev: 2, feb: 2, mar: 3, apr: 4, avr: 4, abr: 4, mai: 5, may: 5, mag: 5,
      jun: 6, giu: 6, jul: 7, lug: 7, aou: 8, aug: 8, ago: 8, sep: 9, set: 9, oct: 10, okt: 10, ott: 10, nov: 11,
      dec: 12, dez: 12, dic: 12 };
    const month = word => {
      const w = word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      return w.startsWith("juil") ? 7 : w.startsWith("juin") ? 6 : months[w.slice(0, 3)];
    };
    let d = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);          // 14.11.2021, 14/11/2021 (11/14/2021 in English)
    if (d) {
      const [day, mon] = english && text.includes("/") ? [d[2], d[1]] : [d[1], d[2]];
      return `${d[3]}-${pad(mon)}-${pad(day)}`;
    }
    d = text.match(/^(\d{1,2})\.?\s+(?:de\s+)?([^\s\d.,]{3,})\.?\s+(?:de\s+)?(\d{4})/);   // 14 novembre 2021, 14. November 2021
    if (d && month(d[2])) return `${d[3]}-${pad(month(d[2]))}-${pad(d[1])}`;
    d = text.match(/^([^\s\d.,]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);                // November 14, 2021
    if (d && month(d[1])) return `${d[3]}-${pad(month(d[1]))}-${pad(d[2])}`;
    return "";
  }

  // Canonical link if it's on the same site, otherwise the current URL without tracking parameters
  const canonical = document.querySelector('link[rel="canonical"]')?.href;
  let link;
  if (canonical && new URL(canonical).hostname === location.hostname) {
    link = canonical;
  } else {
    const u = new URL(location.href);
    u.hash = "";
    // Tracking parameters: families by prefix (utm_source…, Matomo, Piwik, HubSpot ads), else exact names
    // (ad click IDs, Google result links, social networks, newsletters); the rest of the query stays
    const tracking = /^((utm|mtm|matomo|pk|piwik|hsa)_.*|fbclid|gclid|gclsrc|gbraid|wbraid|gad_source|srsltid|msclkid|igshid|igsh|ttclid|twclid|li_fat_id|yclid|mc_cid|mc_eid|_hsenc|_hsmi|mkt_tok|_ga|_ke|ef_id|s_kwcid|epik)$/;
    for (const k of [...u.searchParams.keys()]) {
      if (tracking.test(k)) u.searchParams.delete(k);
    }
    link = u.href;
  }
  // Title without the site name (" | Scientific Reports", " - Le Parisien")
  const site = meta('meta[property="og:site_name"]')?.trim();
  let title = meta('meta[name="citation_title"]') || meta('meta[name="dc.title"]') || meta('meta[name="DC.title"]')
    || meta('meta[property="og:title"]') || document.title;
  title = (title || "").trim();
  if (site) title = title.replace(new RegExp(`\\s+[-|–—:]\\s+${site.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "");
  // Without og:site_name, " | <site>" at the end is still the site ("… | auto-illustré - le magazine automobile suisse")
  title = title.replace(/\s+\|\s+[^|]*$/, "");
  return { published, link, title };
}

// Code forges: repositories (creation), issues and pull or merge requests (opening, with their title), commits
// (commit date, with their subject), from the public REST APIs (CORS allowed; GitHub: 60 requests an hour without
// sign-in), local date as the sites show it. null on other pages (users, /features/…: the API has no such
// repository) and when the API fails, then the generic reader.
// GitHub: /<owner>/<repo>, /issues/<n>, /pull/<n> (own endpoint: repos with issues disabled answer 410 to /issues),
// /commit/<sha>. GitLab: /<group>/…/<project>, /-/issues/<n>, /-/merge_requests/<n>, /-/commit/<sha>.
const FORGES = [
  { pattern: /^https:\/\/github\.com\/([^/?#]+\/[^/?#]+)(?:\/(issues|pull|commit)\/([0-9a-f]+))?(?:[/?#]|$)/,
    root: /^https:\/\/github\.com\/[^/]+\/[^/?#]+\/?([?#]|$)/,
    api: (path, kind, ref) => `https://api.github.com/repos/${path}${kind ? `/${{ issues: "issues", pull: "pulls", commit: "commits" }[kind]}/${ref}` : ""}`,
    link: (path, kind, ref) => `https://github.com/${path}${kind ? `/${kind}/${ref}` : ""}`,
    commit: data => ({ sha: data.sha, date: data.commit.committer.date, title: data.commit.message.split("\n")[0] }) },
  { pattern: /^https:\/\/gitlab\.com\/([^?#]+?)(?:\/-\/(issues|merge_requests|commit)\/([0-9a-f]+)(?:\/[^?#]*)?|\/-\/[^?#]*|\/)?([?#]|$)/,
    root: /^https:\/\/gitlab\.com\/(?:(?!\/-\/)[^?#])+([?#]|$)/,
    api: (path, kind, ref) => `https://gitlab.com/api/v4/projects/${encodeURIComponent(path)}${kind ? `/${kind === "commit" ? "repository/commits" : kind}/${ref}` : ""}`,
    link: (path, kind, ref) => `https://gitlab.com/${path}${kind ? `/-/${kind}/${ref}` : ""}`,
    commit: data => ({ sha: data.id, date: data.committed_date, title: data.title }) }
];

async function forgeLine(url) {
  for (const forge of FORGES) {
    const m = url.match(forge.pattern);
    if (!m || (!m[2] && !forge.root.test(url))) continue;
    const [, path, kind, ref] = m;
    try {
      const res = await fetch(forge.api(path, kind, ref));
      if (!res.ok) return null;
      const data = await res.json();
      if (!kind) return `${localDate(Date.parse(data.created_at))} ${forge.link(path)}`;
      if (kind === "commit") {
        const commit = forge.commit(data);
        const link = forge.link(path, kind, commit.sha);
        return `${localDate(Date.parse(commit.date))} ${titleIfNotInLink(commit.title, link)}${link}`;
      }
      const link = forge.link(path, kind, ref);
      return `${localDate(Date.parse(data.created_at))} ${titleIfNotInLink(data.title, link)}${link}`;
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Firefox add-ons (addons.mozilla.org/<lang>/firefox/addon/<slug>/): date created, from the public API (CORS
// allowed); "Firefox theme" for themes; UTC date like the stores
async function firefoxAddonLine(url) {
  const m = url.match(/^https:\/\/addons\.mozilla\.org\/(?:[a-z]{2}(?:-[A-Z]{2})?\/)?(?:firefox|android)\/addon\/([^/?#]+)/);
  if (!m) return null;
  let addon = {};
  try { addon = await (await fetch(`https://addons.mozilla.org/api/v5/addons/addon/${m[1]}/`)).json(); } catch (e) {}
  return `Firefox ${addon.type === "statictheme" ? "theme" : "ext"} ${formatDate(addon.created) || "?"} https://addons.mozilla.org/firefox/addon/${addon.slug || m[1]}/`;
}


// Wikipedia articles: creation date = timestamp of the first revision (API, CORS with origin=*), UTC date as
// Wikipedia shows it to signed-out readers; redirects followed
async function wikipediaLine(url) {
  const m = url.match(/^https:\/\/([a-z-]+)(?:\.m)?\.wikipedia\.org\/wiki\/([^?#]+)/);
  if (!m) return null;
  let date = "";
  try {
    const api = `https://${m[1]}.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1`
      + `&prop=revisions&rvdir=newer&rvlimit=1&rvprop=timestamp&titles=${encodeURIComponent(decodeURIComponent(m[2]))}`;
    date = formatDate(Object.values((await (await fetch(api)).json()).query.pages)[0].revisions?.[0]?.timestamp);
  } catch (e) {}
  return `${date || "?"} https://${m[1]}.wikipedia.org/wiki/${m[2]}`;
}

// npm packages: date of the first release, "time.created" of the registry document (CORS allowed; it lists every
// version: 16 MB for typescript, ~0.3 s), UTC date like PyPI
async function npmLine(url) {
  const m = url.match(/^https:\/\/www\.npmjs\.com\/package\/((?:@[^/?#]+\/)?[^/?#]+)/);
  if (!m) return null;
  const name = decodeURIComponent(m[1]);
  let date = "";
  try { date = formatDate((await (await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}`)).json()).time.created); } catch (e) {}
  return `${date || "?"} https://www.npmjs.com/package/${name}`;
}

// Release date of an Android app or a Chrome extension on Chrome-Stats, fetched by the service worker (host
// permission: the site sends no CORS header). Same JSON-LD as on its pages, read with a regex (no DOMParser here).
async function chromeStatsDate(id) {
  const link = `https://chrome-stats.com/d/${id}`;
  try {
    const html = await (await fetch(link)).text();
    for (const m of html.matchAll(/<script type="application\/ld\+json"[^>]*>([^]*?)<\/script>/g)) {
      try {
        const app = [JSON.parse(m[1])].flat().find(o => o["@type"] === "SoftwareApplication" && o.url === link);
        if (app) return formatDate(String(app.datePublished || ""));
      } catch (e) {}
    }
  } catch (e) {}
  return "";
}

// Runs in the page (must be self-contained)
async function readChromeStatsInfo() {
  const link = `https://chrome-stats.com${location.pathname.replace(/\/$/, "")}`;
  // JSON-LD SoftwareApplication {"url": "https://chrome-stats.com/d/<id>", "datePublished": "2026-10-24"}, matched on
  // its url since the head can stay from the first page after in-page navigation (then the page is fetched again)
  const appOf = doc => {
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const app = [JSON.parse(s.textContent)].flat().find(o => o["@type"] === "SoftwareApplication" && o.url === link);
        if (app) return app;
      } catch (e) {}
    }
    return null;
  };
  let app = appOf(document);
  if (!app) {
    try { app = appOf(new DOMParser().parseFromString(await (await fetch(link)).text(), "text/html")); } catch (e) {}
  }
  if (!app) return null;
  return { date: String(app.datePublished || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "", link };
}

// Runs in the page (must be self-contained)
async function readAppStoreInfo() {
  const m = location.pathname.match(/^\/(?:([a-z]{2})\/)?app\/(?:[^/]+\/)?id(\d+)/);
  if (!m) return null;
  const [path, country = "us", id] = m;
  // The page's data: data[0].data.lockup is the app, matched on its ID since it stays from the first page after
  // in-page navigation (then the app page is fetched again)
  const lockupOf = doc => {
    try {
      const lockup = JSON.parse(doc.getElementById("serialized-server-data").textContent).data[0].data.lockup;
      return lockup.adamId === id ? lockup : null;
    } catch (e) { return null; }
  };
  let lockup = lockupOf(document);
  if (!lockup) {
    try { lockup = lockupOf(new DOMParser().parseFromString(await (await fetch(path)).text(), "text/html")); } catch (e) {}
  }
  // Platforms of the app ("phone", "pad", "mac", "tv", "watch", "vision"), plus iPhone/iPad apps that also run on
  // Apple silicon Macs or on Apple Vision Pro
  const config = lockup?.buttonAction?.purchaseConfiguration || {};
  const on = new Set(config.appPlatforms || []);
  if (lockup?.isIOSBinaryMacOSCompatible) on.add("mac");
  if (config.supportsVisionOSCompatibleIOSBinary) on.add("vision");
  const NAMES = { mac: "macOS", phone: "iOS", pad: "iPadOS", tv: "tvOS", watch: "watchOS", vision: "visionOS" };
  const platforms = Object.keys(NAMES).filter(p => on.has(p)).map(p => NAMES[p]);
  // The page shows no release date: the public lookup API has it ("2026-10-26T07:00:00Z", midnight in California)
  // and allows requests from apps.apple.com
  let date = "";
  try {
    const iso = (await (await fetch(`https://itunes.apple.com/lookup?id=${id}&country=${country}`)).json()).results[0]?.releaseDate || "";
    date = iso.match(/^\d{4}-\d{2}-\d{2}/)?.[0] || "";
  } catch (e) {}
  return { platforms, date, link: `https://apps.apple.com${path}` };
}

// Runs in the page (must be self-contained)
function readRedditInfo() {
  const id = location.pathname.match(/\/comments\/([a-z0-9]+)/i)?.[1];
  const sub = location.pathname.match(/^\/r\/([A-Za-z0-9_]+)/)?.[1];
  let created, link;
  if (id) {
    // New Reddit: <shreddit-post id="t3_ID" created-timestamp="2024-05-10T12:34:56.789000+0000" permalink="/r/…/comments/ID/slug/">
    // Old Reddit: <div class="thing" data-fullname="t3_ID" data-timestamp="1715344496789" data-permalink="…">
    // Matched on the post ID so a post left over from in-page navigation is never used.
    const post = document.querySelector(`shreddit-post[id="t3_${id}"]`);
    const thing = document.querySelector(`.thing[data-fullname="t3_${id}"]`);
    created = post?.getAttribute("created-timestamp")
      || (thing?.dataset.timestamp && Number(thing.dataset.timestamp));
    if (!created) {
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        const m = s.textContent.match(/"datePublished"\s*:\s*"([^"]+)"/);
        if (m) { created = m[1]; break; }
      }
    }
    // Post link without the comment part, query or fragment
    const permalink = post?.getAttribute("permalink") || thing?.dataset.permalink
      || location.pathname.match(/^(\/r\/[^/]+)?\/comments\/[a-z0-9]+(\/[^/]+)?/i)[0];
    const path = permalink.match(/^(\/r\/[^/]+)?\/comments\/[a-z0-9]+(\/[^/]+)?/i)?.[0] || permalink;
    link = `https://www.reddit.com${path.replace(/\/?$/, "/")}`;
  } else if (sub) {
    // Subreddit creation ("Created Jan 25, 2008"). New Reddit: <faceplate-timeago ts="2008-01-25T03:43:06.921000+0000">
    // in the header's community details, matched on the name (in-page navigation); old Reddit: the sidebar's
    // "a community for <time datetime="2008-01-25T03:43:06+00:00">17 years</time>"
    created = document.querySelector(`shreddit-subreddit-header[name="${sub}" i] [slot="community-details"] faceplate-timeago[ts]`)?.getAttribute("ts")
      || document.querySelector(".side .titlebox .age time[datetime]")?.getAttribute("datetime");
    link = `https://www.reddit.com/r/${sub}/`;
  } else return null;

  // Local date, as Reddit shows times in the viewer's time zone
  let date = "";
  const d = new Date(typeof created === "string"
    ? created.replace(/\.(\d{3})\d*/, ".$1").replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    : created);
  if (created && !isNaN(d)) {
    date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  return { date, link };
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

// Runs in the page (must be self-contained)
function readHackerNewsItemInfo() {
  const id = new URL(location.href).searchParams.get("id");
  if (!id) return null;
  // The item's age ("2 days ago") carries its UTC time: <span class="age" title="2026-10-10T00:37:07[ 1791592627]">
  const age = document.querySelector(".fatitem .age[title]") || document.querySelector(".age[title]");
  const [iso, unix] = (age?.getAttribute("title") || "").split(" ");
  const d = unix ? new Date(Number(unix) * 1000) : new Date(iso ? `${iso}Z` : NaN);
  // Local date, as for the other sites
  const date = isNaN(d) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // Story title (comments have none)
  const title = document.querySelector(".fatitem .titleline > a")?.textContent.trim() || "";
  return { date, title, link: `https://news.ycombinator.com/item?id=${id}` };
}

// Runs in the page (must be self-contained)
function readPubMedInfo() {
  const pmid = location.pathname.match(/^\/(\d+)\/?$/)?.[1];
  if (!pmid) return null;
  // No date metadata: the heading shows "Epub 2020 Dec 10." (online, first) and the issue date
  // "2020 Dec 31;383(27):2603-2615."; a date can lack the day or month ("2026 Jan", "2026")
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parse = text => {
    const m = (text || "").match(/(\d{4})(?:\s+([A-Z][a-z]{2}))?(?:\s+(\d{1,2}))?/);
    if (!m) return "";
    const month = months.indexOf(m[2]) + 1;
    return `${m[1]}-${month ? String(month).padStart(2, "0") : "xx"}-${month && m[3] ? m[3].padStart(2, "0") : "xx"}`;
  };
  // The article's heading comes first in the page, before the similar articles
  const epub = document.querySelector(".secondary-date")?.textContent.match(/Epub\s+([^.]+)/)?.[1];
  const date = parse(epub) || parse(document.querySelector(".article-citation .cit")?.textContent.split(";")[0]);
  const title = (document.querySelector('meta[name="citation_title"]')?.content
    || document.querySelector("h1.heading-title")?.textContent || "").trim().replace(/\.$/, "");
  return { date, title, link: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` };
}

// Runs in the page (must be self-contained)
function readSoundCloudTrackInfo() {
  const link = `https://soundcloud.com${location.pathname.match(/^\/[^/]+\/[^/]+/)[0]}`;
  // window.__sc_hydration (in a page script) holds {hydratable: "sound", data: {kind: "track",
  // permalink_url, display_date: "2012-08-28T01:07:49Z"}}; matched on the link, since the data
  // stays from the first page after in-page navigation
  let iso = "", isTrack = false;
  const script = [...document.scripts].map(s => s.textContent).find(t => t.includes("__sc_hydration"));
  try {
    const sound = JSON.parse(script.match(/__sc_hydration\s*=\s*(\[[^]*?\]);/)[1])
      .find(h => h.hydratable === "sound")?.data;
    if (sound?.permalink_url === link) { isTrack = sound.kind === "track"; iso = sound.display_date || sound.created_at || ""; }
  } catch (e) {}
  // Else the upload time in the track page's header (lists of tracks have no such header)
  if (!iso) {
    const time = document.querySelector(".fullHero__uploadTime time[datetime]");
    if (time) { isTrack = true; iso = time.getAttribute("datetime"); }
  }
  if (!isTrack) return null;
  const d = new Date(iso);
  // Local date, as SoundCloud shows it
  const date = iso && !isNaN(d)
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  return { date, link };
}

// Runs in the page (must be self-contained)
function readPouetProdInfo() {
  const id = new URL(location.href).searchParams.get("which");
  if (!id) return null;
  // JSON-LD MediaObject: {"name": "Wake Up! 16b", "author": "Desire", "uploadDate": "2026-05-17T02:36:13+02:00"}
  let ld = {};
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { const d = JSON.parse(s.textContent); if (d.name) { ld = d; break; } } catch (e) {}
  }
  // Date the prod was added to Pouët (as in the JSON-LD, else "added on the 2026-05-17 02:36:13"),
  // else the release month ("release date : may 2026")
  let date = (ld.uploadDate || "").match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    || document.body.innerText.match(/added on the (\d{4}-\d{2}-\d{2})/)?.[1] || "";
  if (!date) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const m = document.body.innerText.match(/release date\s*:\s*(?:([a-z]{3})[a-z]*\s+)?(\d{4})/i);
    const month = m?.[1] ? months.indexOf(m[1].toLowerCase()) + 1 : 0;
    if (m) date = `${m[2]}-${month ? String(month).padStart(2, "0") : "xx"}-xx`;
  }
  // "Wake Up! 16b by Desire" when there is no JSON-LD; several groups are joined by " & "
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content || "";
  const name = ld.name || ogTitle.replace(/\s+by\s+.*$/, "");
  const author = ld.author || ogTitle.match(/\s+by\s+(.*)$/)?.[1] || "";
  return { date, name: name.trim(), groups: author.split(/\s+&\s+/).map(g => g.trim()).filter(Boolean),
    link: `https://www.pouet.net/prod.php?which=${id}` };
}

// Runs in the page (must be self-contained)
function readSunoSongInfo() {
  const id = location.pathname.match(/^\/song\/([0-9a-f-]{36})/)[1];
  const share = new URL(location.href).searchParams.get("sh");
  // The song data is in the page's scripts: take the "created_at" next to this song's ID
  // (so data left over from in-page navigation is never used)
  const text = [...document.scripts].map(s => s.textContent).join("\n").replace(/\\"/g, '"');
  let created = "";
  for (const m of text.matchAll(/"created_at":"([^"]+)"/g)) {
    if (text.slice(Math.max(0, m.index - 3000), m.index + 3000).includes(`"id":"${id}"`)) { created = m[1]; break; }
  }
  const d = new Date(created);
  // Local date, as Suno shows it
  const date = created && !isNaN(d)
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  const meta = sel => document.querySelector(sel)?.content || "";
  // "The future speaks to us by toutankamo (@toutankamo). Listen and make your own on Suno."
  const handle = meta('meta[name="description"]').match(/\(@([^)]+)\)/)?.[1] || "";
  const title = meta('meta[property="og:title"]').trim();
  return { date, handle, title, link: share ? `https://suno.com/s/${share}` : `https://suno.com/song/${id}` };
}

// Runs in the page's MAIN world (must be self-contained)
async function readShadertoyInfo() {
  const id = location.pathname.match(/^\/view\/(\w+)/)[1];
  const utcDate = unix => new Date(Number(unix) * 1000).toISOString().slice(0, 10);
  // As shown under the shader: "Uploaded by <user> in 2026-10-24"
  let date = document.querySelector("#shaderAuthorDate")?.textContent.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
  let title = document.querySelector("#shaderTitle")?.textContent.trim() || "";
  // Else the page's shader object, else the site's API (date = Unix time)
  const known = window.gShaderToy?.mInfo;
  if (known?.id === id) {
    date ||= known.date ? utcDate(known.date) : "";
    title ||= known.name || "";
  }
  if (!date || !title) {
    try {
      const res = await fetch("/shadertoy", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "s=" + encodeURIComponent(JSON.stringify({ shaders: [id] })) + "&nt=1&nl=1&np=1" });
      const info = (await res.json())?.[0]?.info;
      date ||= info?.date ? utcDate(info.date) : "";
      title ||= info?.name || "";
    } catch (e) {}
  }
  return { date, title, link: `https://www.shadertoy.com/view/${id}` };
}

// Runs in the page (must be self-contained)
// The page shows no date; its same-site record API has the creation time in ms
async function readICloudShortcutInfo() {
  const id = location.pathname.match(/^\/shortcuts\/([0-9a-f]{32})/)[1];
  let record = {};
  try { record = await (await fetch(`/shortcuts/api/records/${id}`)).json(); } catch (e) {}
  return { created: record.created?.timestamp, name: record.fields?.name?.value || "", link: `https://www.icloud.com/shortcuts/${id}` };
}

// Runs in the page (must be self-contained)
// No date metadata: the <relative-time datetime="2026-10-29T16:25:44Z"> of the "<user> released this" line
// ("tagged this" for a bare tag; the other relative-times are signature dates), else the REST API (CORS allowed)
async function readGitHubReleaseInfo() {
  const [, owner, repo, tag] = location.pathname.match(/^\/([^/]+)\/([^/]+)\/releases\/tag\/([^/]+)/);
  let published = [...document.querySelectorAll("relative-time[datetime]")]
    .find(t => /\b(released|tagged) this\b/.test(t.parentElement.textContent))?.getAttribute("datetime") || "";
  if (!published) {
    try { published = (await (await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`)).json()).published_at || ""; } catch (e) {}
  }
  return { published, link: `https://github.com/${owner}/${repo}/releases/tag/${tag}` };
}

// Runs in the page (must be self-contained)
// Steam's store API on the same site gives the release date in English ("18 Apr, 2011"; "Coming soon" text for
// unreleased games) and the platforms; link = canonical (https://store.steampowered.com/app/620/Portal_2/)
async function readSteamAppInfo() {
  const id = location.pathname.match(/^\/app\/(\d+)/)[1];
  let data = {};
  try { data = (await (await fetch(`/api/appdetails?appids=${id}&l=english`)).json())[id].data || {}; } catch (e) {}
  const canonical = document.querySelector('link[rel="canonical"]')?.href || "";
  return { date: data.release_date?.date || "", platforms: data.platforms || {},
    link: canonical.includes(`/app/${id}/`) ? canonical : `https://store.steampowered.com/app/${id}/` };
}

// Runs in the page (must be self-contained)
// Meta Quest Store: "release_info":{"display_date":"21 May 2019"} (in the page's language) follows the app's
// "id":"<id>" in the data of the loaded page. That data comes only with a full page load (a fetched page is an empty
// shell, 210 KB): after in-page navigation the date is "?" until the page is reloaded.
function readMetaQuestAppInfo() {
  const [, slug = "", id] = location.pathname.match(/\/experiences\/([^/]+\/)?(\d+)/);
  const html = document.documentElement.innerHTML;
  const date = [...html.matchAll(/"release_info":\{"display_date":"([^"]+)"\}/g)]
    .find(m => html.slice(Math.max(0, m.index - 3000), m.index).includes(`"id":"${id}"`))?.[1];
  return { date: date || "", lang: document.documentElement.lang || "en", link: `https://www.meta.com/experiences/${slug}${id}/` };
}

// Runs in the page (must be self-contained)
// Flathub: "added_at" (Unix seconds) of the same-site search API's hit for the app id (the API refuses the service
// worker's POST); it is the creation of the app's flathub/<id> repository when there is one. UTC date.
async function readFlathubAppInfo() {
  const id = location.pathname.match(/\/apps\/([A-Za-z0-9._-]+)/)[1];
  let added = 0;
  try {
    const res = await fetch("/api/v2/search", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: id, filters: [] }) });
    added = (await res.json()).hits.find(h => h.app_id === id)?.added_at || 0;
  } catch (e) {}
  return { added, link: `https://flathub.org/apps/${id}` };
}

// Runs in the page (must be self-contained)
// Microsoft Store: "releaseDateUtc" in the product data of the page, once, with "productId":"<id>" (either case; the loaded page's
// when it is that product, else the product page fetched)
async function readMicrosoftStoreInfo() {
  const id = location.pathname.match(/^\/detail\/([a-z0-9]{12})/i)[1].toLowerCase();
  const releasedIn = html => new RegExp(`"productId":"${id}"`, "i").test(html) && html.match(/"releaseDateUtc":"([^"]+)"/)?.[1];
  let released = releasedIn(document.documentElement.innerHTML);
  if (!released) {
    try { released = releasedIn(await (await fetch(`/detail/${id}`)).text()); } catch (e) {}
  }
  return { released: released || "", link: `https://apps.microsoft.com/detail/${id}` };
}

// Runs in the page (must be self-contained)
async function readPyPIProjectInfo() {
  const name = location.pathname.match(/^\/project\/([^/]+)/)[1];
  let date = "";
  // The JSON API (same site) lists every release with its upload time; keep the oldest
  try {
    const data = await (await fetch(`/pypi/${name}/json`)).json();
    date = Object.values(data.releases).flat().map(f => f.upload_time_iso_8601 || f.upload_time).filter(Boolean).sort()[0] || "";
  } catch (e) {}
  // Else the oldest date of the page's release history
  if (!date) {
    date = [...document.querySelectorAll(".release-timeline time[datetime], #history time[datetime]")]
      .map(t => t.getAttribute("datetime")).sort()[0] || "";
  }
  return { date: date.slice(0, 10), link: `https://pypi.org/project/${name}/` };
}

// Runs in the page (must be self-contained)
function readHibpBreachInfo() {
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const m = document.body.innerText.match(/Added to HIBP:\s*(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/i);
  const month = m ? months.indexOf(m[2].toLowerCase()) + 1 : 0;
  const date = month ? `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}` : "";
  const name = location.pathname.match(/^\/Breach\/([^/]+)/i)[1];
  return { date, link: `https://haveibeenpwned.com/Breach/${name}` };
}

// Runs in the page (must be self-contained)
function readYCCompanyInfo() {
  const year = document.body.innerText.match(/Founded:\s*(\d{4})/)?.[1] || "";
  const slug = location.pathname.match(/^\/companies\/([^/]+)/)[1];
  return { year, link: `https://www.ycombinator.com/companies/${slug}` };
}

// Runs in the page (must be self-contained)
function readScienceDirectTopicInfo() {
  const text = document.body.innerText;
  // "AI generated definition based on: Polymers for 3D Printing, 2022", else the oldest excerpt ("From: <book>, 2019")
  let year = text.match(/definition based on:[^\n]*?(\d{4})\s*$/im)?.[1];
  if (!year) year = [...text.matchAll(/^From:[^\n]*?,\s*(\d{4})\s*$/gim)].map(m => m[1]).sort()[0];
  return { year: year || "", link: location.origin + location.pathname };
}
