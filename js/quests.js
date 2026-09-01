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
        ? groups.map(groupHTML).join('')
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
  }

  function groupHTML(group) {
    return '<section class="quest-group tint-' + (group.index % model.TINT_COUNT) + '">' +
      '<h3>' + ui.esc(group.category.name) + '</h3>' +
      group.entries.map(function (entry) {
        return '<button type="button" class="quest-row' + (entry.quest.isCompleted ? ' done' : '') + '"' +
          ' data-quest="' + entry.quest.id + '" aria-pressed="' + entry.quest.isCompleted + '">' +
          '<span class="checkbox">' + (entry.quest.isCompleted ? '✓' : '') + '</span>' +
          '<span class="quest-text">' +
            '<span class="quest-title">' + ui.esc(entry.quest.title) + '</span>' +
            '<span class="quest-goal">' + ui.esc(entry.goal.title) + '</span>' +
          '</span>' +
        '</button>';
      }).join('') +
    '</section>';
  }

  /** Used when the plan changes under us, so the page doesn't sit on a week that's gone. */
  function resetWeek() {
    selectedWeek = null;
  }

  return { render: render, resetWeek: resetWeek };
})();
