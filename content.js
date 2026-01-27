function waitForElm(selector) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

function waitForAnyElm(selectors, timeoutMs = 4000) {
  return new Promise(resolve => {
    for (const sel of selectors) {
      const found = document.querySelector(sel);
      if (found) return resolve(found);
    }

    const observer = new MutationObserver(() => {
      for (const sel of selectors) {
        const found = document.querySelector(sel);
        if (found) {
          observer.disconnect();
          clearTimeout(timeoutId);
          return resolve(found);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

function waitForAnyElmWithText(selectors, timeoutMs = 4000, minLength = 1) {
  return new Promise(resolve => {
    const checkNow = () => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.trim().length >= minLength) return el;
      }
      return null;
    };

    const now = checkNow();
    if (now) return resolve(now);

    const observer = new MutationObserver(() => {
      const found = checkNow();
      if (found) {
        observer.disconnect();
        clearTimeout(timeoutId);
        return resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    const timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function copyYouTubeVideoInfo() {
  // Try to get elements that have non-empty text. Retry loop below helps on SPA navigation.
  const titleSel = ['h1 > yt-formatted-string', 'h1.title yt-formatted-string'];
  const channelSel = ['#owner ytd-channel-name a', 'ytd-channel-name a'];
  const dateSel = ['#info-strings yt-formatted-string', 'span#info-strings yt-formatted-string', 'div#info-strings yt-formatted-string'];

  let titleElm = null, channelElm = null, dateElm = null;

  // Retry a few times to account for SPA navigation and slow DOM updates
  for (let attempt = 0; attempt < 4; attempt++) {
    titleElm = titleElm || await waitForAnyElmWithText(titleSel, 1000, 1);
    channelElm = channelElm || await waitForAnyElmWithText(channelSel, 1000, 1);
    dateElm = dateElm || await waitForAnyElmWithText(dateSel, 1000, 1);
    if (titleElm && channelElm && dateElm) break;
    await new Promise(r => setTimeout(r, 300));
  }

  const title = titleElm?.innerText || "";
  const channel = channelElm?.innerText || "";
  const fullDate = dateElm?.innerText || "";

  // Replace " - " in channel and title
  const cleanChannel = channel.replace(/ - /g, ", ");
  const cleanTitle = title.replace(/ - /g, ", ");

  // Date conversion with fallbacks
  let date = "";
  if (fullDate) {
    const d = new Date(fullDate);
    if (!isNaN(d)) {
      date = formatLocalDate(d);
    }
  }
  // Fallback: use meta tags that contain ISO timestamps
  if (!date) {
    const metaDate = document.querySelector('meta[itemprop="datePublished"], meta[property="article:published_time"]');
    if (metaDate && metaDate.content) {
      const parsed = new Date(metaDate.content);
      if (!isNaN(parsed)) date = formatLocalDate(parsed);
    }
  }

  // Short YouTube URL: support watch?v=, /shorts/, and og:url meta fallback
  let shortUrl = window.location.href;
  const videoIdMatch = window.location.href.match(/[?&]v=([^&]+)/) || window.location.href.match(/\/shorts\/([^?\/]+)/);
  if (videoIdMatch && videoIdMatch[1]) {
    shortUrl = `https://youtu.be/${videoIdMatch[1]}`;
  } else {
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl && ogUrl.content) {
      const m = ogUrl.content.match(/[?&]v=([^&]+)|shorts\/([^?\/]+)/);
      const id = m && (m[1] || m[2]);
      if (id) shortUrl = `https://youtu.be/${id}`;
    }
  }

  // Compose the clipboard string
  const str = `${date} @${cleanChannel} - ${cleanTitle} ${shortUrl}`;

  // Attempt to write to clipboard with retries because clipboard may require focus/user gesture
  let copied = false;
  for (let i = 0; i < 3 && !copied; i++) {
    try {
      await navigator.clipboard.writeText(str);
      copied = true;
    } catch (e) {
      await new Promise(r => setTimeout(r, 250));
    }
  }
  if (!copied) prompt("Copy manually", str);
}

// Listen for a message from the background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "copy_video_info") {
    copyYouTubeVideoInfo();
  }
});
