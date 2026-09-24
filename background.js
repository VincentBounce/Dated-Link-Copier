// The code is injected on click (no static content script), so it works even when
// the video was reached through YouTube's in-page navigation or after an extension reload.
chrome.action.onClicked.addListener(async (tab) => {
  if (!/^https:\/\/(www|m)\.youtube\.com\//.test(tab.url || "")) {
    return flashBadge(tab.id, "✗", "#d93025");
  }

  try {
    // MAIN world: gives access to the YouTube player's data for the current video
    const [{ result: info }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: readVideoInfo
    });
    if (!info) return flashBadge(tab.id, "✗", "#d93025");

    // Replace " - " in channel and title
    const cleanChannel = info.channel.replace(/ - /g, ", ");
    const cleanTitle = info.title.replace(/ - /g, ", ");
    const str = `${formatDate(info.published)} @${cleanChannel} - ${cleanTitle} https://youtu.be/${info.id}`;

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

function flashBadge(tabId, text, color) {
  chrome.action.setBadgeBackgroundColor({ tabId, color });
  chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: "" }), 1500);
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
  return {
    id,
    title: resp?.videoDetails?.title
      || document.querySelector("ytd-watch-metadata h1")?.innerText?.trim() || "",
    channel: resp?.videoDetails?.author || micro?.ownerChannelName
      || document.querySelector("#owner ytd-channel-name a")?.innerText?.trim() || "",
    published: micro?.publishDate || micro?.uploadDate || ""
  };
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
