"use strict";

let activeTab = {};
let prevActiveTab = {};

const delay = ms => new Promise(_ => setTimeout(_, ms));

async function activateTab(windowId, index) {
	console.log(`To be activated: index#${index} of window#${windowId}`);

	async function activateTabById(tabId) {
		try {
			await browser.tabs.update(tabId, { active: true });
			return true;
		}
		catch (e) {
			if (("message" in e) && /^Invalid tab ID/.test(e.message)) {
				return false;
			}
			throw e;
		}
	}

	const attemptLimits = 10;
	for (let i = 0; i < attemptLimits; i++) {
		const tab = (await browser.tabs.query({ index: index, windowId: windowId }))[0];
		if (!tab) {
			return;
		}

		if (await activateTabById(tab.id)) {
			return;
		}

		// The removed tab, which may be the leftmost, is still alive and active internally.
		const waitForDeathMsec = 50;
		await delay(waitForDeathMsec);
	}
}

function hasActivationJustRecentlyHappened(windowId) {
	const maxDeltaMsec = 50;  // New tab activation will take at least 50 msec after removal.

	function tester() {
		const deltaMsec = new Date() - activeTab[windowId].time;
		console.log(
			`The last activation, index#${activeTab[windowId].index} of window#${windowId},`,
			`happened ${deltaMsec} ms before.`);
		return deltaMsec < maxDeltaMsec;
	}

	return tester() ||  // activeTab is not rewrited yet?
		delay(maxDeltaMsec / 5).then(tester);  // XXX: This is a dirty hack to wait for changing activation info.
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
		console.log("onRemoved: Not active tab has been removed.");
		return;
	}

	const removedTab = tabs.find(tab => tab.id == tabId);
	if (removedTab) {
		// The removed tab info is retrievable! In this case, maybe "toolkit.cosmeticAnimations.enabled" pref is true.
		console.log("onRemoved: Animation mode!");
		var tabsLengthAfterRemoval = tabs.length - 1;
	}
	else {
		// The removed tab info is NOT retrievable! In this case, maybe "toolkit.cosmeticAnimations.enabled" pref is false.
		console.log("onRemoved: Non-animation mode!");
		var tabsLengthAfterRemoval = tabs.length;
	}

	if (tabsLengthAfterRemoval < 2) {
		console.log("onRemoved: No-op.");
		return;
	}

	const removed = prevActiveTab[activatedTab.windowId];
	if (removed.id !== tabId) {
		console.log("onRemoved: Something wrong!");
		return;
	}

	const toBeActivatedTabIndex = Math.max(0, removed.index - 1);
	console.log(
		"onRemoved: The previous active tab,",
		`index#${removed.index} of window#${activatedTab.windowId}, has been removed`,
		"and other tab has already been activated.",
		`So activate the appropriate tab of index#${toBeActivatedTabIndex} newly!`
	);

	activateTab(activatedTab.windowId, toBeActivatedTabIndex);
});

browser.tabs.onMoved.addListener((tabId, moveInfo) => {
	browser.tabs.get(tabId)
		.then(tab => {
			if (tab.active) {
				activeTab[moveInfo.windowId] = { index: moveInfo.toIndex, id: tab.id, time: +new Date() };
				prevActiveTab[moveInfo.windowId] = activeTab[moveInfo.windowId];
			}
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
