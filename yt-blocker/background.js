"use strict";

const SAFE_URL = "https://www.youtube.com/";
const BLOCKED_PATTERN = /^https?:\/\/(www\.|m\.)?youtube\.com\/(?:shorts|playables)(?:[/?#]|$)/i;

function isBlockedUrl(url) {
  return typeof url === "string" && BLOCKED_PATTERN.test(url);
}

function redirectTab(tabId, url) {
  if (!isBlockedUrl(url)) {
    return;
  }

  chrome.tabs.update(tabId, { url: SAFE_URL }, () => {
    // Reading lastError prevents noisy unchecked-runtime errors if the tab closed.
    void chrome.runtime.lastError;
  });
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) {
    redirectTab(details.tabId, details.url);
  }
}, {
  url: [
    { hostSuffix: "youtube.com" }
  ]
});

chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId === 0) {
    redirectTab(details.tabId, details.url);
  }
}, {
  url: [
    { hostSuffix: "youtube.com" }
  ]
});
