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

async function copyYouTubeVideoInfo() {
  const titleElm = await waitForElm('h1.title yt-formatted-string');
  const channelElm = await waitForElm('ytd-channel-name a');
  const dateElm = await waitForElm('div#info-strings yt-formatted-string');

  const title = titleElm?.innerText || "";
  const channel = channelElm?.innerText || "";
  const fullDate = dateElm?.innerText || "";

  // Replace " - " in channel and title
  const cleanChannel = channel.replace(/ - /g, ", ");
  const cleanTitle = title.replace(/ - /g, ", ");

  // Date conversion
  let date = "";
  if (fullDate) {
    const d = new Date(fullDate);
    if (!isNaN(d)) {
      date = d.toISOString().slice(0, 10);
    } else {
      const match = fullDate.match(/(\w+)\s+(\d{1,2}),\s*(\d{4})/);
      if (match) {
        const m = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
        if (!isNaN(m)) date = m.toISOString().slice(0, 10);
      }
    }
  }

  // Short YouTube URL
  const videoIdMatch = window.location.href.match(/[?&]v=([^&]+)/);
  let shortUrl = window.location.href;
  if (videoIdMatch && videoIdMatch[1]) {
    shortUrl = `https://youtu.be/${videoIdMatch[1]}`;
  }

  // Compose the clipboard string
  const str = `${date} @${cleanChannel} - ${cleanTitle} - ${shortUrl}`;

  try {
    await navigator.clipboard.writeText(str);
    alert("Copied: " + str);
  } catch (e) {
    prompt("Copy manually", str);
  }
}

// Listen for a message from the background script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "copy_video_info") {
    copyYouTubeVideoInfo();
  }
});
