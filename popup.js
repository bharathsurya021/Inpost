const searchKeywordInput = document.getElementById('searchKeyword');
const numPagesInput = document.getElementById('numPages');
const extractButton = document.getElementById('extractButton');
const searchButton = document.getElementById('searchButton');

const allData = [];
async function initiateExtraction() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    const activeTabId = tab.id;

    const max = Number(numPagesInput.value);

    chrome.storage.local.set({ extractionCount: 0, results: [] });
    chrome.storage.local.get(['extractionCount', 'results'], function (result) {
      const extractionCount = result.extractionCount || 0;
      const results = result.results || [];

      chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        func: performExtraction,
        args: [activeTabId, extractionCount, results, max],
      });
    });
  } catch (error) {
    alert('Extraction failed:', error);
  }
}

async function performExtraction(tabId, extractionCount, results, max) {
  const height = document.body.scrollHeight;
  window.scroll(0, height);

  const liElements = document.querySelectorAll(
    'ul.reusable-search__entity-result-list li.reusable-search__result-container'
  );

  for (let i = 0; i < liElements.length; i++) {
    const li = liElements[i];
    const anchor = li.querySelector('a.app-aware-link');
    const paragraph = li.querySelector('p.entity-result__content-summary');

    if (anchor && paragraph) {
      const profileUrl = anchor.href;
      const summary = paragraph.textContent.replace(/\s+/g, ' ').trim();
      results.push({ profileUrl, summary });
    }
  }

  extractionCount++;

  setTimeout(() => {
    const nextButton = document.querySelector('button[aria-label="Next"]');
    if (nextButton && extractionCount < max) {
      nextButton.click();
      setTimeout(() => {
        performExtraction(tabId, extractionCount, results, max);
      }, 2000);
    } else if (extractionCount === max) {
      chrome.runtime.sendMessage({ extractionComplete: true, data: results });
      return { results, extractionCount, max };
    }
  }, 2000);
  return { results, extractionCount, max };
}

extractButton.addEventListener('click', initiateExtraction);

searchButton.addEventListener('click', function () {
  const keyword = searchKeywordInput.value;
  const searchUrl = `https://www.linkedin.com/search/results/all/?keywords=%23${keyword}`;

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const currentTab = tabs[0];
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      func: function (url) {
        window.location.href = url;
      },
      args: [searchUrl],
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.extractionComplete) {
    const outputTextarea = document.getElementById('output');
    outputTextarea.value = JSON.stringify(message.data, null, 2);
    const downloadLink = document.getElementById('downloadLink');
    const csvContent = message.data
      .map((item) => `${item.profileUrl},${item.summary}`)
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.download = 'result.csv';
    downloadLink.style.display = 'block';
  }
});
