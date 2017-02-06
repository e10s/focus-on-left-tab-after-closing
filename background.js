let activeTab = {};
let prevActiveTab = {};

function activateTab(windowId, index) {
	browser.tabs.query({ index: index, windowId: windowId })
		.then(tabs => {
			console.log(`To be activated: index#${index} of window#${windowId}`);
			browser.tabs.update(tabs[0].id, { active: true });
		});
}

browser.tabs.onActivated.addListener(activeInfo => {
	browser.tabs.get(activeInfo.tabId)
		.then(tab => {
			prevActiveTab[tab.windowId] = activeTab[tab.windowId];
			activeTab[tab.windowId] = { index: tab.index, id: tab.id, time: +new Date() };
		});
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
	if (removeInfo.isWindowClosing) {
		return;
	}

	// XXX: Sucks!
	browser.tabs.get(tabId)
		.then(tab => {  // The tab might be still alive. In this case, maybe "browser.tabs.animate" is true.
			if (tab.index == 0) {  // TODO: Handle the rightmost tab to reduce costs.
				return;
			}


			if (activeTab[tab.windowId].id === tabId) {  // The current active tab might NOT be newly activated by removal.
				console.log(`onRemoved: The active tab of index#${tab.index} in window#${tab.windowId} is still alive and active` +
					" but it will been removed soon.");
				activateTab(tab.windowId, tab.index - 1);
			}
			else {
				const maxDeltaMsec = 50;  // XXX: New tab activation will take at least 50 msec after removal.
				const deltaMsec = new Date() - activeTab[tab.windowId].time;
				if (deltaMsec < maxDeltaMsec) {  // The current active tab might be newly activated by removal.
					console.log(`onRemoved: The tab of index#${tab.index} in window#${tab.windowId} is still alive,` +
						" but it is no longer active and will been removed soon.");
					activateTab(tab.windowId, tab.index - 1);
				}
			}

		})
		.catch(e => {  // The tab might have gone away so that its information is not retrievable.
			if (!("message" in e) || !/^Invalid tab ID/.test(e.message)) {  // "Invalid tab ID" error was thrown?
				console.error(e);
				return;
			}

			browser.tabs.query({ currentWindow: true })
				.then(tabs => {
					// Try to judge whether the removed tab was active or not, by a crazy way.
					const windowId = tabs[0].windowId;
					const maxDeltaMsec = 50;  // XXX: New tab activation will occur within 50 msec after removal.
					const deltaMsec = new Date() - activeTab[windowId].time;
					if (deltaMsec > maxDeltaMsec) {  // The current active tab might not be newly activated by removal.
						return;
					}

					const maxIndexBeforeRemoval = tabs.length;
					for (const tab of tabs) {
						if (tab.active) {
							if (tab.index > 0 && prevActiveTab[windowId].index < maxIndexBeforeRemoval && prevActiveTab[windowId].id === tabId) {
								console.log("onRemoved: The previous active tab," +
									` index#${tab.index} of window#${windowId}, might have been removed` +
									" and the right tab might have already been activated.");
								activateTab(windowId, tab.index - 1);
							}
							break;
						}
					}
				});

		});
});

browser.windows.onFocusChanged.addListener(windowId => {
	browser.tabs.query({ active: true, windowId: windowId })
		.then(tabs => {
			if (tabs.length) {
				activeTab[windowId] = { index: tabs[0].index, id: tabs[0].id, time: +new Date() };
				prevActiveTab[windowId] = activeTab[windowId];
			}
		});
});
