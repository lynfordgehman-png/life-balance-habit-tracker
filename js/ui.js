/*
 * ui.js — small shared helpers: escaping, dialogs, and press handling.
 */
window.App = window.App || {};

App.ui = (function () {
  'use strict';

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(selector, root) {
    return (root || document).querySelector(selector);
  }

  /**
   * Opens the shared dialog with the given content.
   * `onOpen` receives the dialog body so a view can wire up its own fields.
   */
  function openSheet(title, bodyHTML, onOpen) {
    const dialog = el('#sheet');
    el('#sheet-title').textContent = title;
    const body = el('#sheet-body');
    body.innerHTML = bodyHTML;
    if (onOpen) onOpen(body, dialog);
    if (!dialog.open) dialog.showModal();
    return dialog;
  }

  function closeSheet() {
    const dialog = el('#sheet');
    if (dialog.open) dialog.close();
  }

  /**
   * Tap and long press on one element, on both touch and mouse.
   * A long press cancels the tap so a box never counts twice.
   */
  function attachPress(element, onTap, onLongPress, holdMs) {
    let timer = null;
    let longPressed = false;

    function clear() {
      if (timer) clearTimeout(timer);
      timer = null;
    }

    element.addEventListener('pointerdown', function (event) {
      if (event.button && event.button !== 0) return;
      longPressed = false;
      clear();
      timer = setTimeout(function () {
        longPressed = true;
        if (onLongPress) onLongPress(event);
      }, holdMs || 450);
    });

    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (name) {
      element.addEventListener(name, function (event) {
        const wasPending = timer !== null;
        clear();
        if (name === 'pointerup' && wasPending && !longPressed && onTap) onTap(event);
      });
    });

    element.addEventListener('contextmenu', function (event) { event.preventDefault(); });
  }

  /** A yes/no confirmation built on the shared dialog. */
  function confirmSheet(title, message, confirmLabel, onConfirm) {
    openSheet(title,
      '<p class="sheet-message">' + esc(message) + '</p>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn" data-role="cancel">Cancel</button>' +
        '<button type="button" class="btn danger" data-role="confirm">' + esc(confirmLabel) + '</button>' +
      '</div>',
      function (body) {
        body.querySelector('[data-role="cancel"]').addEventListener('click', closeSheet);
        body.querySelector('[data-role="confirm"]').addEventListener('click', function () {
          closeSheet();
          onConfirm();
        });
      });
  }

  /** Hour and minute selects, so the time is always a 24-hour clock. */
  function timeSelects(minutes) {
    const hour = minutes === null || minutes === undefined ? 8 : Math.floor(minutes / 60);
    const minute = minutes === null || minutes === undefined ? 0 : minutes % 60;
    let hours = '';
    for (let index = 0; index < 24; index += 1) {
      hours += '<option value="' + index + '"' + (index === hour ? ' selected' : '') + '>' +
        String(index).padStart(2, '0') + '</option>';
    }
    let mins = '';
    for (let index = 0; index < 60; index += 1) {
      mins += '<option value="' + index + '"' + (index === minute ? ' selected' : '') + '>' +
        String(index).padStart(2, '0') + '</option>';
    }
    return '<div class="time-row">' +
      '<select data-field="hour" aria-label="Hour">' + hours + '</select>' +
      '<span class="time-colon">:</span>' +
      '<select data-field="minute" aria-label="Minute">' + mins + '</select>' +
      '</div>';
  }

  return {
    esc: esc,
    el: el,
    openSheet: openSheet,
    closeSheet: closeSheet,
    attachPress: attachPress,
    confirmSheet: confirmSheet,
    timeSelects: timeSelects
  };
})();
