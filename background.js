"use strict";

// SCHEME:
//
// We handle only visible (== not hidden) tabs.
// The successor of the leftmost tab is set to its right one when there are multiple tabs.
// Otherwise, if there is only one tab, it has no specific successor, that is, a virtual tab with ID -1 is assigned.
// For other visible tabs, the left of each tab is the successor.
// Example:
//    <==== <==== <=============
// [ A ] [ B ] [ C ] [HIDDEN] [ D ]
//    ====>

function setAllSuccessors(windowId, independentTabId = undefined) { // XXX: This might be slow when too many tabs are open.
	browser.tabs.query({ hidden: false, windowId: windowId })
		.then(tabs => {
			const idsRTL = (independentTabId === undefined ? tabs : tabs.filter(a => a != independentTabId))
				.sort((a, b) => b.index - a.index).map(a => a.id);
			const $ = idsRTL.length;
			browser.tabs.moveInSuccession(idsRTL, $ >= 2 ? idsRTL[$ - 2] : undefined);
		});
}

/// Listeners for tab state change
browser.tabs.onAttached.addListener((tabId, attachInfo) => {
	setAllSuccessors(attachInfo.newWindowId);
});

browser.tabs.onCreated.addListener(tab => {
	setAllSuccessors(tab.WindowId);
});

browser.tabs.onDetached.addListener((tabId, detachInfo) => {
	setAllSuccessors(detachInfo.oldWindowId);
});

browser.tabs.onMoved.addListener((tabId, moveInfo) => {
	setAllSuccessors(moveInfo.windowId);
});

browser.tabs.onRemoved.addListener((tabId, removeInfo) => {
	if (removeInfo.isWindowClosing) {
		return;
	}
	setAllSuccessors(removeInfo.windowId, tabId); // The removed tab info will be retrievable if "toolkit.cosmeticAnimations.enabled" pref is true.
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	setAllSuccessors(tab.windowId);
}, { properties: ["hidden"] }
);

/// For debugging
function _setSuccessor(tabId, successorTabId) {
	browser.tabs.update(tabId, { successorTabId: successorTabId });
}

function _dumpSuccessor(tabId) {
	browser.tabs.get(tabId).then(t => console.log(`${t.id} => ${t.successorTabId}`));
}

function _moveInWindow(tabId, newIndex) {
	browser.tabs.move(tabId, { index: newIndex });
}

function _enumTabs(windowId) {
	browser.tabs.query({ windowId: windowId }).then(console.log);
}

function _enumWindows() {
	browser.windows.getAll({ populate: true }).then(console.log);
}
