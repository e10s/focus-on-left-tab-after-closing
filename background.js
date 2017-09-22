let activeTab = {};
let prevActiveTab = {};

function activateTab(windowId, index) {
	browser.tabs.query({ index: index, windowId: windowId })
		.then(tabs => {
			console.log(`To be activated: index#${index} of window#${windowId}`);
			browser.tabs.update(tabs[0].id, { active: true });
		});
}

async function hasActivationJustRecentlyHappened(windowId, testOnceMore = true) {
	const maxDeltaMsec = 50;  // New tab activation will take at least 50 msec after removal.
	const deltaMsec = new Date() - activeTab[windowId].time;
	console.log("The last activation happened", deltaMsec, "ms before.");
	if (deltaMsec < maxDeltaMsec) {
		return true;
	}
	else if (testOnceMore) {  // activeTab is not rewrited yet?
		const timeoutMsec = 10;
		await (() => new Promise(_ => setTimeout(_, timeoutMsec)))();  // XXX: This is a dirty hack to wait for changing activation info.
		return hasActivationJustRecentlyHappened(windowId, false);
	}
	else {  // Give up!
		return false;
	}
}

browser.tabs.onActivated.addListener(activeInfo => {
	browser.tabs.get(activeInfo.tabId)
		.then(tab => {
			prevActiveTab[tab.windowId] = activeTab[tab.windowId];
			activeTab[tab.windowId] = { index: tab.index, id: tab.id, time: +new Date() };
		});
});

browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
	if (removeInfo.isWindowClosing) {
		return;
	}

	console.log(`onRemoved: id#${tabId}`);
	const tabs = await browser.tabs.query({ currentWindow: true });
	const activatedTab = tabs.find(tab => tab.active);

	if (!await hasActivationJustRecentlyHappened(activatedTab.windowId)) {
		// The current active tab might not be newly activated by removal.
		console.log("onRemoved: Not active tab has removed.");
		return;
	}

	const removedTab = tabs.find(tab => tab.id == tabId);
	if (removedTab) {
		// The removed tab info is retrievable! In this case, maybe "toolkit.cosmeticAnimations.enabled" pref is true.
		console.log("onRemoved: Animation mode!");

		if (activatedTab.index == removedTab.index + 1) {  // It is certain the rightmost tab was not removed.
			console.log(
				"onRemoved:",
				`The tab of index#${removedTab.index} in window#${removedTab.windowId}`,
				"is dying and will be removed soon."
			);

			if (removedTab.index > 0) {
				activateTab(removedTab.windowId, removedTab.index - 1);
			}
			else {
				console.log("onRemoved: The leftmost tab has removed.");

			}
		}
		else {
			console.log("onRemoved: The rightmost tab has removed, or something.");
		}
	}
	else {
		// The removed tab info is NOT retrievable! In this case, maybe "toolkit.cosmeticAnimations.enabled" pref is false.
		console.log("onRemoved: Non-animation mode!");

		if (activatedTab.index === 0) {
			console.log("onRemoved: The leftmost tab has removed, or something.");
			return;
		}

		const tabsLengthAfterRemoval = tabs.length;
		const removed = prevActiveTab[activatedTab.windowId];
		if (removed.index < tabsLengthAfterRemoval && removed.id === tabId) {
			console.log(
				"onRemoved: The previous active tab,",
				`index#${activatedTab.index} of window#${activatedTab.windowId}, might have been removed`,
				"and the right tab might have already been activated."
			);
			activateTab(activatedTab.windowId, activatedTab.index - 1);
		}
		else {
			console.log("onRemoved: The rightmost tab has removed, or something.");
		}
	}
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
