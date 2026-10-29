// Offscreen document: writes the line to the clipboard for the service worker, which has no DOM.
// navigator.clipboard needs a focused document, so a selected textarea and execCommand("copy").
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "copy") return;
  const ta = document.querySelector("textarea");
  ta.value = message.text;
  ta.select();
  sendResponse(document.execCommand("copy"));
});
