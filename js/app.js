/*
 * app.js — tabs, the lock screen, and service worker registration.
 */
window.App = window.App || {};

(function () {
  'use strict';

  const ui = App.ui;
  const lock = App.lock;

  const PAGES = {
    habits: { title: 'Habits', render: function () { App.habits.render(); } },
    quests: { title: 'Weekly Quests', render: function () { App.quests.render(); } },
    goals: { title: '12 Week Goals', render: function () { App.goals.render(); } }
  };

  let current = 'habits';

  function renderChrome() {
    ui.el('#page-title').textContent = PAGES[current].title;

    const actions = ui.el('#header-actions');
    actions.innerHTML = current === 'habits'
      ? '<button type="button" class="icon-btn" id="action-lock" aria-label="Password lock">' +
          (lock.isEnabled() ? '🔒' : '🔓') + '</button>' +
        '<button type="button" class="icon-btn" id="action-add" aria-label="Add habit">＋</button>'
      : current === 'goals'
        ? '<button type="button" class="icon-btn" id="action-menu" aria-label="Options">⋯</button>' +
          '<button type="button" class="icon-btn" id="action-add" aria-label="Add goal">＋</button>'
        : '';

    const addButton = ui.el('#action-add');
    if (addButton) {
      addButton.addEventListener('click', function () {
        if (current === 'habits') App.habits.openEditor(null);
        else App.goals.openGoalEditor(null);
      });
    }
    const lockButton = ui.el('#action-lock');
    if (lockButton) lockButton.addEventListener('click', openLockSettings);

    const menuButton = ui.el('#action-menu');
    if (menuButton) {
      menuButton.addEventListener('click', function () {
        ui.openSheet('Options',
          '<div class="sheet-actions column">' +
            '<button type="button" class="btn" data-role="report">Print Progress Report</button>' +
            '<button type="button" class="btn" data-role="categories">Edit Categories</button>' +
            '<button type="button" class="btn" data-role="due">Set Due Date</button>' +
            '<button type="button" class="btn quiet" data-role="cancel">Cancel</button>' +
          '</div>',
          function (body) {
            body.querySelector('[data-role="report"]').addEventListener('click', function () {
              ui.closeSheet();
              App.report.open();
            });
            body.querySelector('[data-role="categories"]').addEventListener('click', function () {
              ui.closeSheet();
              App.goals.openCategories();
            });
            body.querySelector('[data-role="due"]').addEventListener('click', function () {
              ui.closeSheet();
              App.goals.openDueDate();
            });
            body.querySelector('[data-role="cancel"]').addEventListener('click', ui.closeSheet);
          });
      });
    }

    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.classList.toggle('on', tab.dataset.page === current);
      tab.setAttribute('aria-selected', tab.dataset.page === current);
    });

    document.querySelectorAll('.page').forEach(function (page) {
      page.classList.toggle('hidden', page.id !== 'page-' + current);
    });
  }

  function renderAll() {
    renderChrome();
    PAGES[current].render();
  }

  // ----------------------------------------------------------------- lock

  function renderLock() {
    const screen = ui.el('#lock-screen');
    const locked = lock.isEnabled() && !lock.isUnlocked();
    screen.classList.toggle('hidden', !locked);
    document.body.classList.toggle('locked', locked);
    if (locked) {
      const input = ui.el('#lock-password');
      input.value = '';
      ui.el('#lock-error').classList.add('hidden');
      setTimeout(function () { input.focus(); }, 50);
    }
  }

  function openLockSettings() {
    if (!lock.available()) {
      ui.confirmSheet(
        'Password Lock',
        'The password lock needs the app opened over https or from localhost, because browsers only allow password hashing in a secure context.',
        'OK',
        function () {}
      );
      return;
    }

    if (!lock.isEnabled()) {
      ui.openSheet('Password Lock',
        '<label class="field"><span>New password</span>' +
          '<input type="password" data-field="new" autocomplete="new-password"></label>' +
        '<label class="field"><span>Confirm password</span>' +
          '<input type="password" data-field="confirm" autocomplete="new-password"></label>' +
        '<p class="hint">At least ' + lock.MINIMUM_LENGTH + ' characters. The app asks for it on ' +
          'launch and whenever it goes to the background. A forgotten password cannot be recovered.</p>' +
        '<p class="error hidden" data-field="error"></p>' +
        '<div class="sheet-actions">' +
          '<button type="button" class="btn" data-role="cancel">Cancel</button>' +
          '<button type="button" class="btn primary" data-role="save">Turn On</button>' +
        '</div>',
        function (body) {
          body.querySelector('[data-role="cancel"]').addEventListener('click', ui.closeSheet);
          body.querySelector('[data-role="save"]').addEventListener('click', async function () {
            const password = body.querySelector('[data-field="new"]').value;
            const confirm = body.querySelector('[data-field="confirm"]').value;
            const error = body.querySelector('[data-field="error"]');

            if (password.length < lock.MINIMUM_LENGTH) {
              error.textContent = 'Use at least ' + lock.MINIMUM_LENGTH + ' characters.';
              error.classList.remove('hidden');
              return;
            }
            if (password !== confirm) {
              error.textContent = "The passwords don't match.";
              error.classList.remove('hidden');
              return;
            }
            await lock.setPassword(password);
            ui.closeSheet();
            renderChrome();
          });
        });
      return;
    }

    ui.openSheet('Password Lock',
      '<p class="hint">Password lock is on.</p>' +
      '<label class="field"><span>Current password</span>' +
        '<input type="password" data-field="current" autocomplete="current-password"></label>' +
      '<label class="field"><span>New password (optional)</span>' +
        '<input type="password" data-field="new" autocomplete="new-password"></label>' +
      '<p class="error hidden" data-field="error"></p>' +
      '<div class="sheet-actions column">' +
        '<button type="button" class="btn primary" data-role="change">Change Password</button>' +
        '<button type="button" class="btn danger" data-role="off">Turn Off Password Lock</button>' +
        '<button type="button" class="btn quiet" data-role="cancel">Cancel</button>' +
      '</div>',
      function (body) {
        const error = body.querySelector('[data-field="error"]');

        function fail(message) {
          error.textContent = message;
          error.classList.remove('hidden');
        }

        body.querySelector('[data-role="cancel"]').addEventListener('click', ui.closeSheet);
        body.querySelector('[data-role="change"]').addEventListener('click', async function () {
          const current = body.querySelector('[data-field="current"]').value;
          const next = body.querySelector('[data-field="new"]').value;
          if (next.length < lock.MINIMUM_LENGTH) {
            fail('Use at least ' + lock.MINIMUM_LENGTH + ' characters.');
            return;
          }
          if (!(await lock.setPassword(next, current))) {
            fail('That current password is wrong.');
            return;
          }
          ui.closeSheet();
        });
        body.querySelector('[data-role="off"]').addEventListener('click', async function () {
          const current = body.querySelector('[data-field="current"]').value;
          if (!(await lock.disable(current))) {
            fail('That password is wrong.');
            return;
          }
          ui.closeSheet();
          renderChrome();
        });
      });
  }

  // ----------------------------------------------------------------- boot

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        current = tab.dataset.page;
        // Each page opens on the present, not wherever it was left.
        if (current === 'habits') App.habits.resetWeek();
        if (current === 'quests') App.quests.resetWeek();
        renderAll();
      });
    });

    ui.el('#lock-form').addEventListener('submit', async function (event) {
      event.preventDefault();
      const input = ui.el('#lock-password');
      if (await lock.unlock(input.value)) {
        input.value = '';
      } else {
        ui.el('#lock-error').classList.remove('hidden');
        input.value = '';
        input.focus();
      }
    });

    App.store.subscribe(renderAll);
    lock.subscribe(renderLock);

    lock.start();
    renderLock();
    renderAll();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(function (error) {
        console.warn('Service worker did not register', error);
      });
    }
  });
})();
