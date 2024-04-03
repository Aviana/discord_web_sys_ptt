/*
On startup, connect to the "discord_web_sys_ptt" app.
*/
let port = chrome.runtime.connectNative("com.aviana.discord_web_sys_ptt");

/**
 * The default minimum number of ms that any 'PTT active' window can last.
 * @const {number}
 */
const MIN_PTT_LENGTH_DEFAULT = 800;

/**
 * Runs the given callback with the tab ID for the broadcasting Discord tab, if
 * one exists.
 *
 * @param {function(number)} cb - A callback that will be run on the
 *     broadcasting Discord tab ID.
 */
function withBroadcastingTab(cb) {
  chrome.storage.local.get('broadcastingTab', function(result) {
    if (result.broadcastingTab != null) {
      cb(result.broadcastingTab);
    }
  });
}

/**
 * Propogates the stored min PTT length, or the default (if no value has been stored).
 *
 * @param {function(number)} cb - A callback that will be run with the stored
 *     min PTT length as its argument.
 * @return {boolean} true if cb will be called asynchronously.
 */
function sendMinPttLength(cb) {
  chrome.storage.local.get('minPttLength', function(result) {
    cb(result.minPttLength != null ? result.minPttLength : MIN_PTT_LENGTH_DEFAULT);
  });
  return true;
}

/**
 * Stores the new min PTT length and updates all popups and Discord tabs about
 * the change.
 *
 * @param {number} minPttLength - The new minimum PTT length.
 */
function onMinPttLengthChanged(minPttLength) {
  chrome.storage.local.set({
    minPttLength: minPttLength,
  });

  // Send message to Discord tab.
  withBroadcastingTab(function(id) {
    chrome.tabs.sendMessage(id, {
      id: 'min_ptt_length_changed',
      value: minPttLength,
    });
  });
}

/**
 * Updates extension badge when a Discord tab starts / stops broadcasting.
 *
 * @param {number} id - The ID of the tab that has started or stopped broadcasting.
 * @param {boolean} broadcasting - true if this is as notice that broadcasting
 *     has started.
 */
function onBroadcastingNotice(id, broadcasting) {
  chrome.storage.local.get('broadcastingTab', function(result) {
    if (broadcasting) {
      chrome.storage.local.set({
        broadcastingTab: id,
      });
    } else if (result.broadcastingTab === id) {
      chrome.storage.local.set({
        broadcastingTab: null,
      });
    }
  });
}

// Handle messages from Discord tabs and popups.
chrome.runtime.onMessage.addListener(function(msg, sender, cb) {
  if (msg.id === 'discord_loaded') {
    return sendMinPttLength(cb);
  } else if (msg.id === 'min_ptt_length_changed') {
    onMinPttLengthChanged(msg.value);
    return false;
  } else if (msg.id === 'broadcasting' && sender != null &&
    sender.tab != null && sender.tab.id != null) {
    onBroadcastingNotice(sender.tab.id, msg.value);
    return false;
  }

  return false;
});

/*
Listen for messages from the app.
*/
port.onMessage.addListener((response) => {
  console.log("Got binding from portal: " + response)
  withBroadcastingTab(function(id) {
    chrome.tabs.sendMessage(id, {
      id: 'ext_shortcut_pushed',
    });
  });
});
