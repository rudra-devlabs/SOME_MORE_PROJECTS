chrome.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) return;
  
  // We cannot inject into restricted URLs like chrome:// or edge://
  if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
    console.error("Cannot launch PiP from a restricted browser page. Please use a normal website.");
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['launcher.js']
  }).catch(err => console.error("Failed to inject launcher:", err));
});