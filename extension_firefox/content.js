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
 * Value used to specify keyboard shortcuts in the Discord web client.
 * @const {number}
 */
const DISCORD_KEYBOARD = 0;

/**
 * Value used to specify browser shortcuts in the Discord web client.
 * @const {number}
 */
const DISCORD_BROWSER = 4;

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

/** Sends a PTT keyup event. */
function pttOff() {
  pttEndTime = null;

  if (keyEventInits !== null) {
    document.dispatchEvent(new KeyboardEvent('keyup', keyEventInits));
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
    document.dispatchEvent(new KeyboardEvent('keydown', keyEventInits));
  }
}

/**
 * Helper to get the keycodes for ptt from the storage string
 */
function parseShortcut(storageValue) {
  // There will be no MediaEngineStore entry on first usage of the Discord web
  // client.
  if (storageValue == null) return [];

  try {
    const value = JSON.parse(storageValue).default;
    if (value.mode !== 'PUSH_TO_TALK') {
      return [];
    }

    // Return a list of key codes, from the list with entries of the form:
    //   [KEYBOARD, key code, BROWSER].
    return value.modeOptions.shortcut.map(function(vs) {
      if (vs.length != 3 || vs[0] != DISCORD_KEYBOARD || vs[2] != DISCORD_BROWSER) {
        throw new Error("unrecognised shortcut specification.");
      }
      return vs[1];
    }).sort();
  } catch (err) {
    console.error('Couldn\'t parse PTT shortcut: ' + err.message);
    return [];
  }
}

/**
 * Craft KeyboardEvent payload
 */
function getKeycodes() {
  keyEventInits = {};
  let keyCodeList = parseShortcut(localStorage.getItem("MediaEngineStore"));
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

// Respond to changes
window.addEventListener('storage', function(e) {
  console.log(e)
});

chrome.storage.onChanged.addListener(function(changes, areaName) {
  console.log(changes)
});

// Notify background script that we're a Discord tab.
chrome.runtime.sendMessage({
  id: 'discord_loaded',
}, minPttLength => {
  pttDelayFirst = minPttLength;
});

// Try loading already stored ptt bind
getKeycodes();
