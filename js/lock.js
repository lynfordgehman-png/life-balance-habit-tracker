/*
 * lock.js — optional password lock.
 *
 * The password is never stored: a random salt and a PBKDF2-SHA256 hash go in
 * localStorage, and unlocking re-derives the hash to compare. Web Crypto needs a
 * secure context, so this is available over https or localhost, not from file://.
 */
window.App = window.App || {};

App.lock = (function () {
  'use strict';

  const KEY = 'lifebalance.lock.v1';
  const ITERATIONS = 120000;
  const SALT_BYTES = 16;
  const HASH_BITS = 256;

  const MINIMUM_LENGTH = 4;

  let unlocked = true;
  const listeners = [];

  function available() {
    return !!(window.crypto && crypto.subtle && crypto.subtle.deriveBits);
  }

  function record() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function isEnabled() {
    return !!record();
  }

  function isUnlocked() {
    return unlocked;
  }

  function notify() {
    listeners.forEach(function (listener) { listener(); });
  }

  function toBase64(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
  }

  function fromBase64(text) {
    return Uint8Array.from(atob(text), function (character) { return character.charCodeAt(0); });
  }

  async function derive(password, salt) {
    const material = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt, iterations: ITERATIONS, hash: 'SHA-256' },
      material,
      HASH_BITS
    );
    return new Uint8Array(bits);
  }

  /** Compares every byte so a wrong password can't be timed out one character at a time. */
  function constantTimeEquals(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1) {
      difference |= left[index] ^ right[index];
    }
    return difference === 0;
  }

  async function verify(password) {
    const saved = record();
    if (!saved || !available()) return false;
    const derived = await derive(password, fromBase64(saved.salt));
    return constantTimeEquals(derived, fromBase64(saved.hash));
  }

  /** Turns the lock on, or replaces the password when `current` matches the old one. */
  async function setPassword(password, current) {
    if (password.length < MINIMUM_LENGTH || !available()) return false;
    if (isEnabled() && !(await verify(current || ''))) return false;

    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const hash = await derive(password, salt);
    localStorage.setItem(KEY, JSON.stringify({
      salt: toBase64(salt),
      hash: toBase64(hash),
      iterations: ITERATIONS
    }));
    unlocked = true;
    notify();
    return true;
  }

  async function disable(current) {
    if (!(await verify(current))) return false;
    localStorage.removeItem(KEY);
    unlocked = true;
    notify();
    return true;
  }

  async function unlock(password) {
    if (!(await verify(password))) return false;
    unlocked = true;
    notify();
    return true;
  }

  function lock() {
    if (!isEnabled()) return;
    unlocked = false;
    notify();
  }

  /** Locks on load, and again whenever the app is hidden or backgrounded. */
  function start() {
    if (isEnabled()) unlocked = false;
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') lock();
    });
    window.addEventListener('pagehide', lock);
    notify();
  }

  return {
    MINIMUM_LENGTH: MINIMUM_LENGTH,
    available: available,
    isEnabled: isEnabled,
    isUnlocked: isUnlocked,
    setPassword: setPassword,
    disable: disable,
    unlock: unlock,
    lock: lock,
    start: start,
    subscribe: function (listener) { listeners.push(listener); }
  };
})();
