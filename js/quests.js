/*
 * quests.js — the weekly quests page, filled from the 12 week goals.
 */
window.App = window.App || {};

App.quests = (function () {
  'use strict';

  const model = App.model;
  const store = App.store;
  const ui = App.ui;

  let selectedWeek = null;

  function week() {
    const plan = store.plan();
    const fallback = model.weekContaining(plan, new Date());
    return Math.min(Math.max(1, selectedWeek || fallback), store.weekCount());
  }

  function render() {
    const page = ui.el('#page-quests');

    if (!store.hasAnyQuests()) {
      page.innerHTML =
        '<div class="empty">' +
          '<h2>No Quests Yet</h2>' +
          '<p>Quests come from your 12 week goals. Add a goal with weekly quests and they show up here.</p>' +
        '</div>';
      return;
    }

    const current = week();
    const rate = store.completionRate(current);
    const percent = rate === null ? null : Math.round(rate * 100);
    const band = model.progressBand(percent === null ? 0 : percent);
    const groups = store.categoryEntries(current);

    page.innerHTML =
      '<section class="week-header">' +
        '<div class="week-nav">' +
          '<button type="button" class="nav-arrow" data-step="-1"' + (current <= 1 ? ' disabled' : '') + ' aria-label="Previous week">‹</button>' +
          '<div class="week-title">' +
            '<h2>Week ' + current + '</h2>' +
            '<p>of ' + store.weekCount() + ' · ' + ui.esc(model.weekRangeLabel(store.plan(), current)) + '</p>' +
          '</div>' +
          '<button type="button" class="nav-arrow" data-step="1"' + (current >= store.weekCount() ? ' disabled' : '') + ' aria-label="Next week">›</button>' +
        '</div>' +
        '<div class="progress band-' + band + '">' +
          '<p class="percent">' + (percent === null ? '—' : percent + '%') +
            '<span class="percent-label">complete this week</span></p>' +
          '<div class="bar"><span style="width:' + Math.round((rate || 0) * 100) + '%"></span></div>' +
        '</div>' +
      '</section>' +

      (groups.length
        ? groups.map(function (group) { return groupHTML(group, current); }).join('')
        : '<p class="note">No quests scheduled for this week.</p>');

    page.querySelectorAll('[data-step]').forEach(function (button) {
      button.addEventListener('click', function () {
        selectedWeek = current + Number(button.dataset.step);
        render();
      });
    });

    page.querySelectorAll('[data-quest]').forEach(function (row) {
      row.addEventListener('click', function () {
        store.toggleQuest(row.dataset.quest);
      });
    });

    page.querySelectorAll('[data-carry]').forEach(function (button) {
      button.addEventListener('click', function () {
        store.carryForward(button.dataset.carry);
      });
    });
  }

  /**
   * The carry-forward offer only makes sense once the week is finished —
   * on its last day, or any time after it has passed.
   */
  function weekIsOver(week) {
    const end = model.weekRange(store.plan(), week).end;
    return model.startOfDay(new Date()) >= model.startOfDay(end);
  }

  function groupHTML(group, week) {
    const offerCarry = weekIsOver(week);

    return '<section class="quest-group tint-' + (group.index % model.TINT_COUNT) + '">' +
      '<h3>' + ui.esc(group.category.name) + '</h3>' +
      group.entries.map(function (entry) {
        const quest = entry.quest;
        let carry = '';

        if (offerCarry && !quest.isCompleted) {
          if (store.alreadyCarried(quest)) {
            carry = '<p class="carried">Carried into week ' + (quest.week + 1) + '</p>';
          } else if (store.canCarryForward(quest)) {
            carry = '<button type="button" class="carry-btn" data-carry="' + quest.id + '">' +
              'Move to week ' + (quest.week + 1) + '</button>';
          }
        }

        return '<div class="quest-item">' +
          '<button type="button" class="quest-row' + (quest.isCompleted ? ' done' : '') + '"' +
            ' data-quest="' + quest.id + '" aria-pressed="' + quest.isCompleted + '">' +
            '<span class="checkbox">' + (quest.isCompleted ? '✓' : '') + '</span>' +
            '<span class="quest-text">' +
              '<span class="quest-title">' + ui.esc(quest.title) + '</span>' +
              '<span class="quest-goal">' + ui.esc(entry.goal.title) + '</span>' +
            '</span>' +
          '</button>' + carry +
        '</div>';
      }).join('') +
    '</section>';
  }

  /** Used when the plan changes under us, so the page doesn't sit on a week that's gone. */
  function resetWeek() {
    selectedWeek = null;
  }

  /** Pins the page to a specific week — used by the weekly review to step through weeks. */
  function showWeek(weekNumber) {
    selectedWeek = weekNumber;
    render();
  }

  return { render: render, resetWeek: resetWeek, showWeek: showWeek };
})();
