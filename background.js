// Create a context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "copyVideoInfo",
    title: "Copy YouTube Video Info",
    contexts: ["all"],
    documentUrlPatterns: ["*://*.youtube.com/watch*"]
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "copyVideoInfo") {
    chrome.tabs.sendMessage(tab.id, { action: "getVideoInfo" });
  }
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (tab.url.includes("youtube.com/watch")) {
    chrome.tabs.sendMessage(tab.id, { action: "getVideoInfo" });
  }
});