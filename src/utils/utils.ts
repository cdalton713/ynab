import * as statusAnd from "./statusAnd";

function getDocumentHtml(): Promise<string> {
  try {
    if (document.readyState === 'loading') {
      // Honestly, not sure if this first branch works...
      return new Promise((resolve) => {
        document.addEventListener('DOMContentLoaded', () => {
          resolve(document.body.innerHTML);
        });
      });
    } else {
      return Promise.resolve(document.body.innerHTML);
    }
  } catch (e) {
    console.log(e)
    return Promise.resolve("")
  }
}

export const getHtml = async (tabId: number) => {
  const page = await chrome.scripting.executeScript({
    target: {tabId},
    func: getDocumentHtml,
    args: [],
  })

  if (!page || !page[0].result) {
    throw statusAnd.error(`Unable to get HTML for tab ${tabId}`)
  }

  return page[0].result
}



export const getActiveTab = async () => {
  // Get tab - works while dev tools is open
  const tab: chrome.tabs.Tab | undefined = await new Promise(resolve => {
    chrome.windows.getCurrent(w => {
      chrome.tabs.query({active: true, windowId: w.id}, tabs => {
        resolve(tabs[0]);
      });
    })
  })

  if (!tab?.id) {
    throw statusAnd.error('Could not get current tab.')
  }

  return tab
}