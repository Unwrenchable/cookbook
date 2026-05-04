/**
 * Server-side no-op stub for @walletconnect/keyvaluestorage.
 *
 * Root cause: @walletconnect/keyvaluestorage@1.1.1 imports its browser
 * module (idb.ts) at the top level, which immediately calls
 * `createStore()` from idb-keyval, which calls `indexedDB.open()` directly
 * (no typeof guard). In Node.js (SSR/SSG), `indexedDB` is not a declared
 * global, so this throws:
 *
 *   ReferenceError: indexedDB is not defined
 *
 * Fix: webpack-alias this package to the present stub for server builds
 * (see next.config.js). On the server, wallet connections never happen,
 * so a no-op storage implementation is correct behaviour.
 */
"use strict";

class KeyValueStorage {
  async getKeys() {
    return [];
  }
  async getItem(_key) {
    return null;
  }
  async setItem(_key, _value) {
    // no-op
  }
  async removeItem(_key) {
    // no-op
  }
}

exports.KeyValueStorage = KeyValueStorage;
exports["default"] = KeyValueStorage;
