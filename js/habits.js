/*
 * habits.js — the daily habits page.
 */
window.App = window.App || {};

App.habits = (function () {
  'use strict';

  const model = App.model;
  const store = App.store;
  const ui = App.ui;

  // 0 is this week, -4 is four weeks back. Four weeks of history, no further.
  const HISTORY_WEEKS = 4;
  let weekOffset = 0;

  function isCurrentWeek() {
    return weekOffset === 0;
  }

  function shownDays() {
    return model.weekDays(model.addDays(new Date(), weekOffset * 7));
  }

  function render() {
    const page = ui.el('#page-habits');
    const days = shownDays();
    const current = isCurrentWeek();
    const habits = store.habitsForWeek(days, current);

    if (!habits.length) {
      // On the current week with nothing ever added, the big first-run CTA.
      // On a past week, adding isn't available there, so just say so.
      page.innerHTML = current
        ? weekBarHTML(days) +
          '<div class="empty">' +
            '<h2>No Habits Yet</h2>' +
            '<p>Add a habit and choose how many times a day or week you want to do it.</p>' +
            '<button type="button" class="btn primary" id="empty-add-habit">Add Habit</button>' +
          '</div>'
        : weekBarHTML(days) +
          '<p class="note">No habits were tracked this week.</p>';

      const addButton = page.querySelector('#empty-add-habit');
      if (addButton) addButton.addEventListener('click', function () { openEditor(null); });
      wireWeekBar(page);
      return;
    }

    page.innerHTML = weekBarHTML(days) +
      habits.map(function (habit) { return cardHTML(habit, days); }).join('');

    wireWeekBar(page);

    page.querySelectorAll('.habit-card').forEach(function (card) {
      const habit = store.habit(card.dataset.habit);
      if (!habit) return;

      ui.attachPress(card.querySelector('.habit-head'), null, function () {
        if (isCurrentWeek()) openActions(habit);
        else openHistoryNotice();
      });

      card.querySelectorAll('.day-box').forEach(function (box) {
        if (box.disabled) return;
        const date = model.parseKey(box.dataset.day);
        ui.attachPress(
          box,
          function () { store.tapDay(habit.id, date); },
          function () { store.decrementDay(habit.id, date); }
        );
      });
    });
  }

  function wireWeekBar(page) {
    page.querySelectorAll('[data-week-step]').forEach(function (button) {
      button.addEventListener('click', function () {
        weekOffset = Math.min(0, Math.max(-HISTORY_WEEKS, weekOffset + Number(button.dataset.weekStep)));
        render();
        // The header's Add button depends on which week is showing, so refresh it too.
        App.nav.refreshChrome();
      });
    });
  }

  function weekLabel() {
    if (weekOffset === 0) return 'This week';
    if (weekOffset === -1) return 'Last week';
    return Math.abs(weekOffset) + ' weeks ago';
  }

  /** Week label with a step back into history, and forward again. */
  function weekBarHTML(days) {
    return '<div class="hist-bar">' +
      '<button type="button" class="hist-arrow" data-week-step="-1"' +
        (weekOffset <= -HISTORY_WEEKS ? ' disabled' : '') + ' aria-label="Previous week">‹</button>' +
      '<p class="hist-label">' +
        '<span class="hist-when">' + ui.esc(weekLabel()) + '</span>' +
        '<span class="hist-range">' + ui.esc(model.rangeLabel(days[0], days[6])) + '</span>' +
      '</p>' +
      '<button type="button" class="hist-arrow" data-week-step="1"' +
        (weekOffset >= 0 ? ' disabled' : '') + ' aria-label="This week">›</button>' +
    '</div>';
  }

  /** Shown instead of the edit/delete menu when holding a card outside the current week. */
  function openHistoryNotice() {
    ui.openSheet('Past Week',
      '<p class="sheet-message">Adding, editing and deleting habits only applies to the current week. ' +
        'Switch to this week to make changes — what you see here stays exactly as it happened.</p>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn" data-role="close">Close</button>' +
        '<button type="button" class="btn primary" data-role="now">Go to This Week</button>' +
      '</div>',
      function (body) {
        body.querySelector('[data-role="close"]').addEventListener('click', ui.closeSheet);
        body.querySelector('[data-role="now"]').addEventListener('click', function () {
          weekOffset = 0;
          ui.closeSheet();
          render();
          App.nav.refreshChrome();
        });
      });
  }

  function cardHTML(habit, days) {
    const total = model.weeklyTotal(habit, days);
    const target = model.weeklyTarget(habit);
    const time = model.timeLabel(habit);
    const complete = total >= target ? ' complete' : '';

    return '<article class="habit-card period-' + model.period(habit) + '" data-habit="' + habit.id + '">' +
      '<header class="habit-head">' +
        '<div class="habit-titles">' +
          '<h2>' + ui.esc(habit.name) + '</h2>' +
          '<p class="habit-sub">' +
            (time ? '<span class="habit-time">' + time + '</span><span class="dot">·</span>' : '') +
            ui.esc(model.targetDescription(habit)) +
          '</p>' +
        '</div>' +
        '<span class="week-badge' + complete + '">' + total + '<span class="of">/ ' + target + '</span></span>' +
      '</header>' +
      '<div class="day-row">' + days.map(function (date, index) {
        return boxHTML(habit, date, index);
      }).join('') + '</div>' +
    '</article>';
  }

  function boxHTML(habit, date, index) {
    const count = model.countOn(habit, date);
    const single = model.isSingleTap(habit);
    const future = model.isFuture(date);
    const classes = ['day-box'];
    if (count > 0) classes.push('filled');
    if (model.isToday(date)) classes.push('today');
    if (future) classes.push('future');

    const mark = count > 0
      ? (single ? '<span class="mark check">✓</span>' : '<span class="mark">' + count + '</span>')
      : '';

    return '<button type="button" class="' + classes.join(' ') + '" data-day="' + model.dayKey(date) + '"' +
      (future ? ' disabled' : '') +
      ' aria-label="' + model.DAY_NAMES[index] + (model.isToday(date) ? ', today' : '') +
      ': ' + (count > 0 ? count + ' completed' : 'not completed') + '">' +
      '<span class="letter">' + model.DAY_LETTERS[index] + '</span>' + mark +
      '</button>';
  }

  // ------------------------------------------------------------- editing

  function openActions(habit) {
    ui.openSheet(habit.name,
      '<div class="sheet-actions column">' +
        '<button type="button" class="btn" data-role="edit">Edit Habit</button>' +
        '<button type="button" class="btn danger" data-role="delete">Delete Habit</button>' +
        '<button type="button" class="btn quiet" data-role="cancel">Cancel</button>' +
      '</div>',
      function (body) {
        body.querySelector('[data-role="edit"]').addEventListener('click', function () {
          ui.closeSheet();
          openEditor(habit);
        });
        body.querySelector('[data-role="delete"]').addEventListener('click', function () {
          ui.closeSheet();
          ui.confirmSheet('Delete Habit', 'Delete “' + habit.name + '” and everything tracked for it?', 'Delete', function () {
            store.deleteHabit(habit.id);
          });
        });
        body.querySelector('[data-role="cancel"]').addEventListener('click', ui.closeSheet);
      });
  }

  function openEditor(habit) {
    const editing = !!habit;
    const frequency = editing ? habit.frequency : 'daily';
    const targetCount = editing ? habit.targetCount : 1;
    const minutes = editing ? habit.scheduledMinutes : null;
    const hasTime = minutes !== null && minutes !== undefined;

    ui.openSheet(editing ? 'Edit Habit' : 'New Habit',
      '<label class="field"><span>Habit</span>' +
        '<input type="text" data-field="name" placeholder="e.g. Drink water" value="' +
        ui.esc(editing ? habit.name : '') + '" autocomplete="off"></label>' +

      '<div class="field"><span>How often</span>' +
        '<div class="segmented" data-field="frequency">' +
          '<button type="button" data-value="daily" class="' + (frequency === 'daily' ? 'on' : '') + '">Daily</button>' +
          '<button type="button" data-value="weekly" class="' + (frequency === 'weekly' ? 'on' : '') + '">Weekly</button>' +
        '</div>' +
      '</div>' +

      '<label class="field"><span>How many times</span>' +
        '<div class="stepper">' +
          '<button type="button" data-step="-1" aria-label="Fewer">−</button>' +
          '<output data-field="count">' + targetCount + '</output>' +
          '<button type="button" data-step="1" aria-label="More">+</button>' +
          '<span class="stepper-unit" data-field="unit"></span>' +
        '</div>' +
      '</label>' +

      '<label class="field row"><span>Set a time</span>' +
        '<input type="checkbox" data-field="has-time"' + (hasTime ? ' checked' : '') + '></label>' +
      '<div data-field="time-wrap" class="' + (hasTime ? '' : 'hidden') + '">' +
        ui.timeSelects(hasTime ? minutes : 8 * 60) +
        '<p class="hint" data-field="period-hint"></p>' +
      '</div>' +

      '<p class="hint" data-field="summary"></p>' +

      '<div class="sheet-actions">' +
        '<button type="button" class="btn" data-role="cancel">Cancel</button>' +
        '<button type="button" class="btn primary" data-role="save">' + (editing ? 'Save' : 'Add') + '</button>' +
      '</div>',
      function (body) {
        const state = { frequency: frequency, count: targetCount };

        function currentMinutes() {
          if (!body.querySelector('[data-field="has-time"]').checked) return null;
          return Number(body.querySelector('[data-field="hour"]').value) * 60 +
            Number(body.querySelector('[data-field="minute"]').value);
        }

        function refresh() {
          body.querySelector('[data-field="count"]').textContent = state.count;
          const unit = (state.count === 1 ? 'time' : 'times') +
            (state.frequency === 'daily' ? ' per day' : ' per week');
          body.querySelector('[data-field="unit"]').textContent = unit;

          const preview = { frequency: state.frequency, targetCount: state.count, scheduledMinutes: currentMinutes() };
          body.querySelector('[data-field="summary"]').textContent = summaryFor(preview);
          body.querySelector('[data-field="period-hint"]').textContent =
            model.periodTitle(model.period(preview)) + ' habit, listed in time order.';
        }

        body.querySelectorAll('[data-field="frequency"] button').forEach(function (button) {
          button.addEventListener('click', function () {
            state.frequency = button.dataset.value;
            body.querySelectorAll('[data-field="frequency"] button').forEach(function (other) {
              other.classList.toggle('on', other === button);
            });
            refresh();
          });
        });

        body.querySelectorAll('[data-step]').forEach(function (button) {
          button.addEventListener('click', function () {
            state.count = Math.min(20, Math.max(1, state.count + Number(button.dataset.step)));
            refresh();
          });
        });

        body.querySelector('[data-field="has-time"]').addEventListener('change', function (event) {
          body.querySelector('[data-field="time-wrap"]').classList.toggle('hidden', !event.target.checked);
          refresh();
        });

        body.querySelectorAll('[data-field="hour"], [data-field="minute"]').forEach(function (select) {
          select.addEventListener('change', refresh);
        });

        body.querySelector('[data-role="cancel"]').addEventListener('click', ui.closeSheet);
        body.querySelector('[data-role="save"]').addEventListener('click', function () {
          const name = body.querySelector('[data-field="name"]').value;
          if (!name.trim()) return;
          if (editing) {
            store.updateHabit(habit.id, name, state.frequency, state.count, currentMinutes());
          } else {
            store.addHabit(name, state.frequency, state.count, currentMinutes());
          }
          ui.closeSheet();
        });

        refresh();
      });
  }

  function summaryFor(habit) {
    const target = model.weeklyTarget(habit);
    if (habit.frequency === 'daily') {
      return habit.targetCount === 1
        ? 'Tap a day box to check it off. ' + target + ' taps make a full week.'
        : "Each tap raises that day's count. " + target + ' taps make a full week.';
    }
    return habit.targetCount <= 7
      ? 'Check off any ' + habit.targetCount + ' day' + (habit.targetCount === 1 ? '' : 's') + ' of the week.'
      : "More than seven a week, so each tap raises that day's count. " + target + ' taps make a full week.';
  }

  /** Coming back to the page always starts on this week. */
  function resetWeek() {
    weekOffset = 0;
  }

  return { render: render, openEditor: openEditor, resetWeek: resetWeek, isCurrentWeek: isCurrentWeek };
})();
