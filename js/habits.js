/*
 * habits.js — the daily habits page.
 */
window.App = window.App || {};

App.habits = (function () {
  'use strict';

  const model = App.model;
  const store = App.store;
  const ui = App.ui;

  function render() {
    const page = ui.el('#page-habits');
    const days = model.weekDays();
    const habits = store.sortedHabits();

    if (!habits.length) {
      page.innerHTML =
        '<div class="empty">' +
          '<h2>No Habits Yet</h2>' +
          '<p>Add a habit and choose how many times a day or week you want to do it.</p>' +
          '<button type="button" class="btn primary" id="empty-add-habit">Add Habit</button>' +
        '</div>';
      page.querySelector('#empty-add-habit').addEventListener('click', function () { openEditor(null); });
      return;
    }

    page.innerHTML =
      '<p class="week-range">' + ui.esc(model.rangeLabel(days[0], days[6]).toUpperCase()) + '</p>' +
      habits.map(function (habit) { return cardHTML(habit, days); }).join('');

    page.querySelectorAll('.habit-card').forEach(function (card) {
      const habit = store.habit(card.dataset.habit);
      if (!habit) return;

      ui.attachPress(card.querySelector('.habit-head'), null, function () { openActions(habit); });

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

  return { render: render, openEditor: openEditor };
})();
