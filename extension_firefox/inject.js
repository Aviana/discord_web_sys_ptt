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
 * Parses and returns the PTT shortcut from a serialized MediaEngineStore
 * structure.
 *
 * @param {?Object} storageValue - The string value associated with the
 *     MediaEngineStore key in local storage, or null if no such key exists in
 *     local storage.
 * @return {!Array<number>} The list of key codes specified as the PTT shortcut
 *     in the MediaEngineStore structure, or an empty list if PTT is not
 *     enabled or there was an error.
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

console.log("Inject successful")

/**
 * Parses and returns the broadcasting status from a serialized
 * SelectedChannelStore structure.
 *
 * @param {?Object} storageValue - The string value associated with the
 *     SelectedChannelStore key in local storage, or null if no such key exists
 *     in local storage.
 * @return {boolean} true if the current page is broadcasting the user's voice.
 */
function parseBroadcastingStatus(storageValue) {
  if (storageValue == null) return false;

  try {
    const value = JSON.parse(storageValue);
    return value.selectedVoiceChannelId != null && value.lastConnectedTime !== 0;
  } catch (err) {
    console.error('Couldn\'t parse broadcasting status: ' + err.message);
    return false;
  }
}

// Overrides method to notify extension about local storage changes.
window.localStorage.__proto__ = Object.create(Storage.prototype);
window.localStorage.__proto__.setItem = (function() {
  // Notify about initial PTT shortcut.
  let prevShortcut = parseShortcut(window.localStorage.getItem('MediaEngineStore'));
  document.dispatchEvent(new CustomEvent('BwpttShortcutChanged', {
    'detail': prevShortcut,
  }));

  // Notify if the tab is immediately broadcasting.
  let prevBroadcasting = parseBroadcastingStatus(
      window.localStorage.getItem('SelectedChannelStore'));
  document.dispatchEvent(new CustomEvent('BwpttBroadcasting', {
    'detail': prevShortcut.length > 0 && prevBroadcasting,
  }));

  return function(key, value) {
    if (key === 'MediaEngineStore') {
      prevShortcut = parseShortcut(value);

      document.dispatchEvent(new CustomEvent('BwpttBroadcasting', {
        'detail': prevShortcut.length > 0 && prevBroadcasting,
      }));

      document.dispatchEvent(new CustomEvent('BwpttShortcutChanged', {
        'detail': prevShortcut,
      }));
    } else if (key === 'SelectedChannelStore') {
      prevBroadcasting = parseBroadcastingStatus(value);

      document.dispatchEvent(new CustomEvent('BwpttBroadcasting', {
        'detail': prevShortcut.length > 0 && parseBroadcastingStatus(value),
      }));
    }

    Storage.prototype.setItem.apply(this, arguments);
  };
})();
