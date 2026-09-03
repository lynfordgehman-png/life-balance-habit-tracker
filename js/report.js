/*
 * report.js — the printable progress report.
 *
 * Builds a plain document of every goal and quest, then hands it to the
 * browser's print dialog. Print styles hide the app itself.
 */
window.App = window.App || {};

App.report = (function () {
  'use strict';

  const model = App.model;
  const store = App.store;
  const ui = App.ui;

  function open() {
    const host = ui.el('#report');
    host.innerHTML = documentHTML();
    host.classList.remove('hidden');
    document.body.classList.add('reporting');

    host.querySelector('[data-role="print"]').addEventListener('click', function () {
      window.print();
    });
    host.querySelector('[data-role="close"]').addEventListener('click', close);
  }

  function close() {
    ui.el('#report').classList.add('hidden');
    document.body.classList.remove('reporting');
  }

  function counts() {
    let total = 0;
    let done = 0;
    store.goals().forEach(function (goal) {
      goal.quests.forEach(function (quest) {
        total += 1;
        if (quest.isCompleted) done += 1;
      });
    });
    return { total: total, done: done, percent: total ? Math.round((done / total) * 100) : null };
  }

  function documentHTML() {
    const plan = store.plan();
    const overall = counts();
    const currentWeek = model.weekContaining(plan, new Date());

    return '<div class="report-tools">' +
        '<button type="button" class="btn" data-role="close">Close</button>' +
        '<button type="button" class="btn primary" data-role="print">Print</button>' +
      '</div>' +
      '<article class="report-sheet">' +
        '<header class="report-head">' +
          '<h1>Progress Report</h1>' +
          '<p class="report-meta">' +
            'Week ' + currentWeek + ' of ' + store.weekCount() + ' · ' +
            'due ' + ui.esc(model.longDate(model.parseKey(plan.endDate))) + ' · ' +
            'printed ' + ui.esc(model.longDate(new Date())) +
          '</p>' +
          '<p class="report-total">' +
            (overall.percent === null
              ? 'No quests yet.'
              : overall.done + ' of ' + overall.total + ' quests complete — ' + overall.percent + '%') +
          '</p>' +
        '</header>' +
        categoriesHTML() +
      '</article>';
  }

  function categoriesHTML() {
    const sections = store.categories().map(function (category) {
      const goals = store.goalsIn(category.id);
      if (!goals.length) return '';
      return '<section class="report-category">' +
        '<h2>' + ui.esc(category.name) + '</h2>' +
        goals.map(goalHTML).join('') +
      '</section>';
    }).join('');

    return sections || '<p class="report-empty">No goals to report yet.</p>';
  }

  function goalHTML(goal) {
    const done = goal.quests.filter(function (quest) { return quest.isCompleted; }).length;
    const percent = goal.quests.length ? Math.round((done / goal.quests.length) * 100) : null;

    let weeks = '';
    for (let week = 1; week <= store.weekCount(); week += 1) {
      const quests = store.questsInWeek(goal, week);
      if (!quests.length) continue;
      weeks += '<div class="report-week">' +
        '<p class="report-week-label">Week ' + week + '</p>' +
        '<ul>' + quests.map(function (quest) {
          return '<li class="' + (quest.isCompleted ? 'is-done' : 'is-open') + '">' +
            '<span class="report-mark">' + (quest.isCompleted ? '✓' : '○') + '</span>' +
            '<span class="report-quest">' + ui.esc(quest.title) + '</span>' +
          '</li>';
        }).join('') + '</ul>' +
      '</div>';
    }

    return '<div class="report-goal">' +
      '<h3>' + ui.esc(goal.title) +
        '<span class="report-score">' +
          (percent === null ? 'no quests' : done + ' / ' + goal.quests.length + ' · ' + percent + '%') +
        '</span>' +
      '</h3>' +
      (weeks || '<p class="report-empty">No quests under this goal.</p>') +
    '</div>';
  }

  return { open: open, close: close };
})();
