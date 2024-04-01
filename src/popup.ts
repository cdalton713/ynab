/**
 * Runs the UI for the applications. This file should be kept simple, and pass
 * any heavy lifting to the extension service worker.
 */
import * as statusAnd from './utils/statusAnd';

// When the popup loads, populate the YNAB Access token field with the stored
// value (if there is one).
document.addEventListener('DOMContentLoaded', function () {
  chrome.storage.local.get("ynab_access_token").then((result) => {
    (document.getElementById('ynab_access_token') as HTMLInputElement).value = result.ynab_access_token ? "************" : '';
  });
});

// When the user clicks the Run button, send a message to the extension service 
// worker to start the transaction gathering process.
document.getElementById("run")!.addEventListener("click", async () => {
  const ynabAccessTokenField = (document.getElementById('ynab_access_token') as HTMLInputElement).value;
  const storedAccessToken = await chrome.storage.local.get("ynab_access_token").then(r => r.ynab_access_token);

  if ((ynabAccessTokenField !== storedAccessToken) && !ynabAccessTokenField.includes("*")) {
    await chrome.storage.local.set({"ynab_access_token": ynabAccessTokenField});
  }
  await chrome.runtime.sendMessage({type: "run", ynabAccessToken: storedAccessToken, "numOrders": 50});
  // The response will come in a different message (see addListener below).
});

// Listen for updates from the extension service worker.
chrome.runtime.onMessage.addListener((message: statusAnd.StatusAnd<string>, sender, sendResponse) => {
  if (statusAnd.isReady(message)) {
    alert('Done! ' + message.result);
  } else {
    alert('Error! ' + message.error)
  }
});