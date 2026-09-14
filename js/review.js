/*
 * review.js — the weekly review flow, launched from the Quests page.
 *
 * A short guided sequence: look back over the week just finished, see how each
 * category did, print it if you want a record, schedule the week ahead, and
 * name a few daily focuses. State lives only in memory — it doesn't survive
 * a reload, on purpose, since a review is a one-sitting thing.
 */
window.App = window.App || {};

App.review = (function () {
  'use strict';

  const model = App.model;
  const store = App.store;
  const ui = App.ui;

  // null | 'review-quests' | 'pie' | 'schedule' | 'focus' | 'congrats'
  let stage = null;
  let reviewWeek = null;
  let scheduleWeek = null;

  function isActive() {
    return stage !== null;
  }

  // ----------------------------------------------------------------- start

  function promptStart() {
    const weekCount = store.weekCount();
    const plan = store.plan();
    const thisWeek = model.weekContaining(plan, new Date());
    const suggested = Math.min(weekCount, Math.max(1, thisWeek - 1));

    let options = '';
    for (let w = 1; w <= weekCount; w += 1) {
      options += '<option value="' + w + '"' + (w === suggested ? ' selected' : '') + '>' +
        'Week ' + w + ' · ' + ui.esc(model.weekRangeLabel(plan, w)) + '</option>';
    }

    ui.openSheet('Weekly Review',
      '<label class="field"><span>Which week do you want to review?</span>' +
        '<select data-field="week">' + options + '</select></label>' +
      '<p class="hint">Defaults to last week. You\'ll review each quest, see how each category did, ' +
        'print it if you want, then schedule the week ahead.</p>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn" data-role="cancel">Cancel</button>' +
        '<button type="button" class="btn primary" data-role="start">Start Review</button>' +
      '</div>',
      function (body) {
        body.querySelector('[data-role="cancel"]').addEventListener('click', ui.closeSheet);
        body.querySelector('[data-role="start"]').addEventListener('click', function () {
          const chosen = Number(body.querySelector('[data-field="week"]').value);
          ui.closeSheet();
          begin(chosen);
        });
      });
  }

  function begin(week) {
    reviewWeek = week;
    scheduleWeek = Math.min(week + 1, store.weekCount());
    stage = 'review-quests';
    App.nav.switchTab('quests');
    App.quests.showWeek(reviewWeek);
    render();
  }

  // ---------------------------------------------------------------- render

  function render() {
    const banner = ui.el('#review-banner');
    if (!banner) return;

    App.nav.refreshChrome();
    const tab = App.nav.currentTab();

    if (stage === 'review-quests' && tab === 'quests') {
      banner.innerHTML = simpleCardHTML(
        'Review each quest',
        'Look over every quest below and make sure it’s checked off if you finished it.',
        '<label class="review-check"><input type="checkbox" id="review-quests-done"> I’ve reviewed each quest</label>'
      );
      banner.classList.remove('hidden');
      wireCheckbox('#review-quests-done', function () { stage = 'pie'; render(); });
    } else if (stage === 'pie' && tab === 'quests') {
      banner.innerHTML = pieStageHTML();
      banner.classList.remove('hidden');
      wirePieStage();
    } else if (stage === 'schedule' && tab === 'quests') {
      banner.innerHTML = simpleCardHTML(
        'Schedule this week’s quests',
        'Add or confirm the quests you want to tackle this week, then mark it done.',
        '<button type="button" class="btn primary" id="review-schedule-done">I’ve Scheduled This Week</button>'
      );
      banner.classList.remove('hidden');
      wireButton('#review-schedule-done', function () {
        stage = 'focus';
        App.nav.switchTab('habits');
        render();
      });
    } else if (stage === 'focus' && tab === 'habits') {
      banner.innerHTML = simpleCardHTML(
        'What are the 3–5 things you need to focus on daily this week?',
        'Decide them now, then note it once you have.',
        '<button type="button" class="btn primary" id="review-focus-done">I’ve Decided My Focus</button>'
      );
      banner.classList.remove('hidden');
      wireButton('#review-focus-done', finish);
    } else if (stage === 'congrats') {
      banner.innerHTML = congratsHTML();
      banner.classList.remove('hidden');
    } else {
      banner.innerHTML = '';
      banner.classList.add('hidden');
    }
  }

  function finish() {
    stage = 'congrats';
    render();
    setTimeout(function () {
      stage = null;
      reviewWeek = null;
      scheduleWeek = null;
      render();
    }, 2000);
  }

  // --------------------------------------------------------------- helpers

  function wireCheckbox(selector, onChecked) {
    const el = ui.el(selector);
    if (!el) return;
    el.addEventListener('change', function () {
      if (el.checked) onChecked();
    });
  }

  function wireButton(selector, onClick) {
    const el = ui.el(selector);
    if (el) el.addEventListener('click', onClick);
  }

  function simpleCardHTML(title, subtitle, controlHTML) {
    return '<div class="review-card"><div class="review-banner-inner">' +
      '<div class="review-text">' +
        '<p class="review-title">' + ui.esc(title) + '</p>' +
        '<p class="review-subtitle">' + ui.esc(subtitle) + '</p>' +
      '</div>' +
      '<div class="review-control">' + controlHTML + '</div>' +
    '</div></div>';
  }

  function congratsHTML() {
    return '<div class="review-card congrats"><div class="review-banner-inner">' +
      '<div class="review-text">' +
        '<p class="review-title">Congratulations on completing the review!</p>' +
        '<p class="review-subtitle">Here’s to another week of phenomenal progress!</p>' +
      '</div>' +
    '</div></div>';
  }

  // ------------------------------------------------------------------ pie

  function pieStageHTML() {
    return '<div class="review-card">' +
      '<div class="review-banner-inner">' +
        '<div class="review-text">' +
          '<p class="review-title">Week ' + reviewWeek + ' by Category</p>' +
          '<p class="review-subtitle">Here’s how each category finished the week.</p>' +
        '</div>' +
      '</div>' +
      '<div class="pie-panel">' + pieSVG(reviewWeek) + legendHTML(reviewWeek) + '</div>' +
      '<div class="review-actions">' +
        '<button type="button" class="btn" id="review-print">Print Report</button>' +
        '<button type="button" class="btn primary" id="review-continue">Continue</button>' +
      '</div>' +
    '</div>';
  }

  function wirePieStage() {
    wireButton('#review-print', openPrint);
    wireButton('#review-continue', function () {
      stage = 'schedule';
      App.quests.showWeek(scheduleWeek);
      render();
    });
  }

  function categoryStats(category, week) {
    const quests = store.goalsIn(category.id).reduce(function (all, goal) {
      return all.concat(store.questsInWeek(goal, week));
    }, []);
    const done = quests.filter(function (quest) { return quest.isCompleted; }).length;
    const total = quests.length;
    return { done: done, total: total, percent: total ? Math.round((done / total) * 100) : 0 };
  }

  function polarPoint(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function wedgePath(cx, cy, r, startAngle, endAngle) {
    const start = polarPoint(cx, cy, r, startAngle);
    const end = polarPoint(cx, cy, r, endAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return 'M ' + cx + ' ' + cy +
      ' L ' + start.x.toFixed(2) + ' ' + start.y.toFixed(2) +
      ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' 1 ' + end.x.toFixed(2) + ' ' + end.y.toFixed(2) + ' Z';
  }

  function anchorFor(angleDeg) {
    const cos = Math.cos((angleDeg * Math.PI) / 180);
    if (cos > 0.3) return 'start';
    if (cos < -0.3) return 'end';
    return 'middle';
  }

  function labelSVG(x, y, name, stats, anchor) {
    const value = stats.total === 0 ? 'No quests' : stats.percent + '%';
    return '<text x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" text-anchor="' + anchor + '" class="pie-label">' +
      '<tspan x="' + x.toFixed(2) + '" dy="0">' + ui.esc(name) + '</tspan>' +
      '<tspan x="' + x.toFixed(2) + '" dy="13">' + ui.esc(value) + '</tspan>' +
    '</text>';
  }

  /**
   * A rose/coxcomb chart: every category gets an equal-angle wedge, and its
   * radius (not its area or angle) encodes that category's completion percent
   * for the week — so slices are comparable by eye at a glance.
   */
  function pieSVG(week) {
    const categories = store.categories();
    const n = categories.length;
    if (n === 0) return '<p class="pie-empty">Add a category to see this chart.</p>';

    const size = 340, cx = size / 2, cy = size / 2, R = 95, labelR = R + 18;
    const stats = categories.map(function (category) { return categoryStats(category, week); });

    let svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="pie-chart" role="img" ' +
      'aria-label="Category completion for week ' + week + '">';

    if (n === 1) {
      const s = stats[0];
      const color = 'var(--pie-0)';
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" class="pie-track" />';
      if (s.total > 0) {
        const r = s.percent > 0 ? (R * s.percent) / 100 : 4;
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '" />';
      }
      svg += labelSVG(cx, cy + labelR, categories[0].name, s, 'middle');
    } else {
      const slice = 360 / n;
      categories.forEach(function (category, i) {
        const start = i * slice - 90;
        const end = start + slice;
        const mid = (start + end) / 2;
        const color = 'var(--pie-' + (i % 6) + ')';
        const s = stats[i];

        svg += '<path d="' + wedgePath(cx, cy, R, start, end) + '" class="pie-track" />';

        if (s.total === 0) {
          svg += '<path d="' + wedgePath(cx, cy, R, start, end) + '" class="pie-empty-wedge" />';
        } else if (s.percent > 0) {
          const r = (R * s.percent) / 100;
          svg += '<path d="' + wedgePath(cx, cy, r, start, end) + '" fill="' + color + '" />';
        } else {
          const dot = polarPoint(cx, cy, 6, mid);
          svg += '<circle cx="' + dot.x.toFixed(2) + '" cy="' + dot.y.toFixed(2) + '" r="4" fill="' + color + '" />';
        }

        const lp = polarPoint(cx, cy, labelR, mid);
        svg += labelSVG(lp.x, lp.y, category.name, s, anchorFor(mid));
      });
    }

    svg += '</svg>';
    return svg;
  }

  function legendHTML(week) {
    const categories = store.categories();
    return '<ul class="pie-legend">' + categories.map(function (category, i) {
      const stats = categoryStats(category, week);
      return '<li><span class="pie-dot" style="background:var(--pie-' + (i % 6) + ')"></span>' +
        '<span class="pie-legend-name">' + ui.esc(category.name) + '</span>' +
        '<span class="pie-legend-value">' +
          (stats.total === 0 ? 'No quests' : stats.done + ' / ' + stats.total + ' · ' + stats.percent + '%') +
        '</span></li>';
    }).join('') + '</ul>';
  }

  // ---------------------------------------------------------------- print

  function openPrint() {
    const host = ui.el('#review-print-sheet');
    host.innerHTML = printHTML(reviewWeek);
    host.classList.remove('hidden');
    document.body.classList.add('reporting');
    host.querySelector('[data-role="print"]').addEventListener('click', function () { window.print(); });
    host.querySelector('[data-role="close"]').addEventListener('click', function () {
      host.classList.add('hidden');
      document.body.classList.remove('reporting');
    });
  }

  function printHTML(week) {
    const groups = store.categoryEntries(week);

    return '<div class="report-tools">' +
        '<button type="button" class="btn" data-role="close">Close</button>' +
        '<button type="button" class="btn primary" data-role="print">Print</button>' +
      '</div>' +
      '<article class="report-sheet">' +
        '<header class="report-head">' +
          '<h1>Week ' + week + ' Review</h1>' +
          '<p class="report-meta">' + ui.esc(model.weekRangeLabel(store.plan(), week)) +
            ' · printed ' + ui.esc(model.longDate(new Date())) + '</p>' +
        '</header>' +
        '<div class="pie-panel print-pie">' + pieSVG(week) + legendHTML(week) + '</div>' +
        (groups.length
          ? groups.map(function (group) {
              return '<section class="report-category"><h2>' + ui.esc(group.category.name) + '</h2>' +
                '<ul class="report-flat-list">' + group.entries.map(function (entry) {
                  return '<li class="' + (entry.quest.isCompleted ? 'is-done' : 'is-open') + '">' +
                    '<span class="report-mark">' + (entry.quest.isCompleted ? '✓' : '○') + '</span>' +
                    '<span class="report-quest">' + ui.esc(entry.quest.title) + '</span>' +
                    '<span class="report-quest-goal">' + ui.esc(entry.goal.title) + '</span>' +
                  '</li>';
                }).join('') + '</ul></section>';
            }).join('')
          : '<p class="report-empty">No quests were scheduled this week.</p>') +
      '</article>';
  }

  return { promptStart: promptStart, isActive: isActive, render: render };
})();
