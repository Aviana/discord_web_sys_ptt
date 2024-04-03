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
 * The URL prefix that indicates the page is an instance of the Discord
 * web app.
 * @const {string}
 */
const DISCORD_APP_URL = 'https://discord.com/channels';

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

  // Send message to all Discord tabs.
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function (tab) {
      if (tab.url && tab.url.startsWith(DISCORD_APP_URL)) {
        chrome.tabs.sendMessage(tab.id, {
          id: 'min_ptt_length_changed',
          value: minPttLength,
        });
      }
    });
  });
}

// Handle messages from Discord tabs and popups.
chrome.runtime.onMessage.addListener(function(msg, sender, cb) {
  if (msg.id === 'discord_loaded') {
    return sendMinPttLength(cb);
  } else if (msg.id === 'min_ptt_length_changed') {
    onMinPttLengthChanged(msg.value);
    return false;
  }

  return false;
});

/*
Listen for messages from the native app and forward them to all discord tabs.
*/
port.onMessage.addListener((response) => {
  // Send message to Discord tab.
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function (tab) {
      if (tab.url && tab.url.startsWith(DISCORD_APP_URL)) {
        chrome.tabs.sendMessage(tab.id, {
          id: 'ext_shortcut_pushed',
        });
      }
    });
  });
});
