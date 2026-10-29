// Clean Link (iOS and macOS Shortcut): cleans every link of the clipboard text the way Dated Link Copier builds
// its links. The shortcut runs this script in a data: page; tools/make_shortcut.py copies TRACKING and
// readableLinks() from background.js into it, so both share one list.

const TRACKING = /*TRACKING*/;

/*READABLE_LINKS*/

// One link: on known sites, the link built from the page's identity (the query there only tracks the share);
// elsewhere the tracking parameters removed, the rest kept (other parameters, fragment)
function cleanLink(href) {
  let u;
  try { u = new URL(href); } catch (e) { return href; }
  const host = u.hostname.replace(/^(www|m|mobile)\./, "");
  const path = u.pathname;
  let m;
  // X posts: s=, t=, a= only say who shared and how
  if (/^(x|twitter)\.com$/.test(host) && (m = path.match(/^\/([^/]+)\/status\/(\d+)/))) {
    return `https://x.com/${m[1]}/status/${m[2]}`;
  }
  // YouTube videos and Shorts: short link, keeping the start time
  const video = host === "youtu.be" ? path.slice(1).split("/")[0]
    : host === "youtube.com" ? (u.searchParams.get("v") || path.match(/^\/shorts\/([^/]+)/)?.[1]) : null;
  if (video) {
    const t = u.searchParams.get("t");
    return `https://youtu.be/${video}${t ? `?t=${t}` : ""}`;
  }
  // Google Play apps: only the app id
  if (host === "play.google.com" && path === "/store/apps/details" && u.searchParams.get("id")) {
    return `https://play.google.com/store/apps/details?id=${u.searchParams.get("id")}`;
  }
  // Amazon products: /dp/<ASIN>
  if (/^amazon\.(com|ca|co\.uk|fr|de|es|it)$/.test(host) && (m = path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/))) {
    return `https://www.${host}/dp/${m[1]}`;
  }
  // Reddit and LinkedIn posts: the path is the post
  if ((/^((old|new|sh)\.)?reddit\.com$/.test(host) && /^\/r\/[^/]+\/comments\//.test(path))
    || (host === "linkedin.com" && /^\/(posts|feed\/update)\//.test(path))) {
    return `https://www.${host.replace(/^(old|new|sh)\./, "")}${path}`;
  }
  const keys = [...u.searchParams.keys()];
  if (!keys.some(k => TRACKING.test(k))) return href;
  for (const k of keys) {
    if (TRACKING.test(k)) u.searchParams.delete(k);
  }
  return u.href;
}

function cleanText(text) {
  return readableLinks(text.replace(/https?:\/\/[^\s<>"]+/g, cleanLink));
}
