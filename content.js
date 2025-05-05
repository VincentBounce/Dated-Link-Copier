chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getVideoInfo") {
    console.log("Received getVideoInfo message");
    const testString = "Test string copied!";
    navigator.clipboard.writeText(testString).then(() => {
      console.log("Test string copied");
      alert("Test string copied to clipboard!");
    }).catch((err) => {
      console.error("Failed to copy:", err);
      alert("Failed to copy test string.");
    });
  }
});