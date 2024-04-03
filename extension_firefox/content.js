/**
 * The default minimum number of ms to wait from initial shortcut message
 * before ending PTT.
 * @const {number}
 */
const PTT_DELAY_FIRST_DEFAULT = 800;

/**
 * The number of ms to wait from last shortcut message before ending PTT.
 * @const {number}
 */
const PTT_DELAY_LAST = 300;

/**
 * A manually-constructed map from modifiers to their (likely) key codes. From
 * https://github.com/wesbos/keycodes/blob/gh-pages/scripts.js.
 * @const {!Array<!Array>}
 */
const MOD_KEY_CODES = [
  ['shiftKey', 16],
  ['ctrlKey', 17],
  ['altKey', 18],
  ['metaKey', 91],
];

/**
 * The list of URL prefixes that indicate the page is an instance of the Discord
 * web app.
 * @const {!Array<string>}
 */
const DISCORD_APP_URLS = [
  'https://discord.com/app', 'https://discord.com/channels',
];

/**
 * The minimum number of ms to wait from initial shortcut message before ending
 * PTT.
 * @type {number}
 */
let pttDelayFirst = PTT_DELAY_FIRST_DEFAULT;

/**
 * The time (in ms past the Unix epoch) at which the active PTT window should
 * end, or null if there is no PTT window currently active.
 * @type {?number}
 */
let pttEndTime = null;

/**
 * The key code and modifier statuses with which to construct syntheic PTT key
 * up/down events for this tab.
 * @type {?Object<string, (number|boolean)}
 */
let keyEventInits = null;

/**
 * The timeout ID for the active PTT window (if one exists).
 * @type {?number}
 */
let toId = null;

/**
 * Whether or not this page appears to be broadcasting PTT voice. This may be a
 * false positive if the page is a non-app Discord page (e.g. Discord developer
 * docs).
 * @type {boolean}
 */
let broadcasting = false;

/**
 * Whether or not this page is a Discord web-app page. When this value is true,
 * the broadcasting value should be transmitted to background script to keep the
 * extension badge etc. updated.
 * @type {boolean}
 */
let isDiscordApp = false;

// Listen for updates to page's PTT shortcut.
document.addEventListener('BwpttShortcutChanged', function(ev) {
  if (ev.detail.length === 0) {
    keyEventInits = null;
    return;
  }

  keyEventInits = {};
  let keyCodeList = ev.detail;
  let lastModKeyCode = -1;
  for ([mod, modKeyCode] of MOD_KEY_CODES) {
    const index = keyCodeList.indexOf(modKeyCode);
    if (index === -1) continue;

    keyCodeList.splice(index, 1);
    keyEventInits[mod] = true;
    lastModKeyCode = modKeyCode;
  }

  if (keyCodeList.length > 1) {
    console.debug('Unknown mod key present: key code ' + keyCodeList);
    return;
  }

  keyEventInits['keyCode'] = keyCodeList.length > 0 ? keyCodeList[0] : lastModKeyCode;
  /**
  keyEventInits['bubbles'] = true;
  keyEventInits['cancelable'] = true;
  keyEventInits['charCode'] = 0;
  keyEventInits['code'] = "KeyP";
  keyEventInits['composed'] = true;
  keyEventInits['isTrusted'] = true;
  keyEventInits['key'] = "p";
  keyEventInits['returnValue'] = true;
  keyEventInits['type'] = "keydown";
  keyEventInits['type'] = 80
  */
  console.log(keyEventInits)
});

// Listen to changes in the page's broadcasting status.
document.addEventListener('BwpttBroadcasting', function(ev) {
  broadcasting = ev.detail;

  if (isDiscordApp) {
    chrome.runtime.sendMessage({
      id: 'broadcasting',
      value: broadcasting,
    });
  }
});

document.addEventListener('keydown', function(ev) {
  console.log(ev)
});

/** Sends a PTT keyup event. */
function pttOff() {
  pttEndTime = null;

  if (keyEventInits !== null) {
    console.log("Ending PTT")
    e = new KeyboardEvent('keyup', keyEventInits)
    document.dispatchEvent(e);
  }
}

/**
 * Extends the PTT off timeout, and sends a PTT keydown event if one hasn't
 * been sent yet.
 */
function onExtShortcut() {
  if (keyEventInits === null) return;

  if (toId !== null) clearTimeout(toId);

  const pttDelay = pttEndTime === null ?
    pttDelayFirst :
    Math.max(PTT_DELAY_LAST, pttEndTime - new Date().getTime());
  toId = setTimeout(pttOff, pttDelay);

  if (pttEndTime === null) {
    pttEndTime = new Date().getTime() + pttDelayFirst;
    console.log("Starting PTT")
    e = new KeyboardEvent('keydown', keyEventInits)
    document.dispatchEvent(e);
  }
}

// Respond to events from the background script.
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.id === 'ext_shortcut_pushed') {
    onExtShortcut();
  } else if (msg.id === 'min_ptt_length_changed') {
    pttDelayFirst = msg.value;
  }

  return false;
});

// Notify background script that we're a Discord tab.
chrome.runtime.sendMessage({
  id: 'discord_loaded',
}, minPttLength => {
  pttDelayFirst = minPttLength;
});

// Never broadcasting once the user navigates away.
window.addEventListener('unload', function() {
  broadcasting = false;
  chrome.runtime.sendMessage({
    id: 'broadcasting',
    value: broadcasting,
  });
});

const nullthrows = (v) => {
  if (v == null) throw new Error('null')
  return v
};

// Inject script to run in page's JS environment.
const injected = document.createElement('script');
injected.src = chrome.runtime.getURL('/inject.js');
nullthrows(document.head || document.documentElement).appendChild(injected);
injected.remove();

window.addEventListener('DOMContentLoaded', function() {
  // The only comprehensive way I've found to track redirects is to watch
  // mutations to the whole document body.
  let observer = new MutationObserver(function(_, ob) {
    isDiscordApp = DISCORD_APP_URLS.some(prefix =>
      document.location.href.startsWith(prefix)
    );

    if (isDiscordApp) {
      chrome.runtime.sendMessage({
        id: 'broadcasting',
        value: broadcasting,
      });

      // Prevent this callback from being called more than necessary (since
      // body modifications are presumably frequent).
      ob.disconnect();
    }
  });

  observer.observe(document.querySelector('body'), {
    childList: true,
    subtree: true,
  });
});
