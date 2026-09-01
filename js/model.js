/*
 * model.js — pure data helpers: dates, weeks, habit rules, plan math.
 * No DOM, no storage. Everything here is a plain function over plain objects.
 */
window.App = window.App || {};

App.model = (function () {
  'use strict';

  // ---------------------------------------------------------------- dates

  const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const next = startOfDay(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  /** Local yyyy-mm-dd. Used as the storage key for a day, and for plan dates. */
  function dayKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return date.getFullYear() + '-' + month + '-' + day;
  }

  /** Parses yyyy-mm-dd as a local date, not UTC. */
  function parseKey(key) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function daysBetween(from, to) {
    return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
  }

  /** The seven days of the week containing `date`, Sunday first. */
  function weekDays(date) {
    const today = startOfDay(date || new Date());
    const sunday = addDays(today, -today.getDay());
    return [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(sunday, offset));
  }

  function isToday(date) {
    return dayKey(date) === dayKey(new Date());
  }

  function isFuture(date) {
    return startOfDay(date) > startOfDay(new Date());
  }

  function monthDay(date) {
    return MONTHS[date.getMonth()] + ' ' + date.getDate();
  }

  /** e.g. "Aug 30 – Sep 5", collapsing the month when it doesn't change. */
  function rangeLabel(first, last) {
    const end = first.getMonth() === last.getMonth() ? String(last.getDate()) : monthDay(last);
    return monthDay(first) + ' – ' + end;
  }

  function longDate(date) {
    return DAY_NAMES[date.getDay()].slice(0, 3) + ', ' + monthDay(date);
  }

  // --------------------------------------------------------------- habits

  /** Times per day (daily) or per week (weekly) that make a full week. */
  function weeklyTarget(habit) {
    return habit.frequency === 'daily' ? habit.targetCount * 7 : habit.targetCount;
  }

  /**
   * True when one tap fills the box, so it shows a checkmark.
   * Daily habits qualify at once a day; weekly habits while the target still fits
   * in seven days — more than that needs more than one tap on some day.
   */
  function isSingleTap(habit) {
    return habit.frequency === 'daily' ? habit.targetCount === 1 : habit.targetCount <= 7;
  }

  function countOn(habit, date) {
    return habit.completions[dayKey(date)] || 0;
  }

  function weeklyTotal(habit, days) {
    return days.reduce((total, date) => total + countOn(habit, date), 0);
  }

  function targetDescription(habit) {
    if (habit.frequency === 'daily') {
      return habit.targetCount === 1 ? 'Once a day' : habit.targetCount + '× a day';
    }
    return habit.targetCount === 1 ? 'Once a week' : habit.targetCount + '× a week';
  }

  /** Morning 00:00–11:59, afternoon 12:00–16:59, evening 17:00–23:59. */
  function period(habit) {
    const minutes = habit.scheduledMinutes;
    if (minutes === null || minutes === undefined) return 'none';
    if (minutes < 12 * 60) return 'morning';
    if (minutes < 17 * 60) return 'afternoon';
    return 'evening';
  }

  function periodTitle(name) {
    return { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', none: 'Anytime' }[name];
  }

  /** 24-hour label, e.g. "07:30". Null when no time is set. */
  function timeLabel(habit) {
    const minutes = habit.scheduledMinutes;
    if (minutes === null || minutes === undefined) return null;
    return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
  }

  /** Scheduled habits by time, unscheduled last, then by when they were created. */
  function sortHabits(habits) {
    return habits.slice().sort(function (a, b) {
      const left = a.scheduledMinutes === null || a.scheduledMinutes === undefined ? Infinity : a.scheduledMinutes;
      const right = b.scheduledMinutes === null || b.scheduledMinutes === undefined ? Infinity : b.scheduledMinutes;
      if (left !== right) return left - right;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
  }

  // ----------------------------------------------------------------- plan

  /** The most recent Saturday on or before `date`. */
  function previousSaturday(date) {
    const today = startOfDay(date || new Date());
    return addDays(today, -((today.getDay() + 1) % 7));
  }

  /**
   * Twelve weeks measured from the previous Saturday, so the plan runs
   * Sunday through Saturday and the due date lands on a Saturday.
   */
  function defaultPlan(date) {
    const saturday = previousSaturday(date);
    return {
      startDate: dayKey(addDays(saturday, 1)),
      endDate: dayKey(addDays(saturday, 84))
    };
  }

  function weekCount(plan) {
    const days = daysBetween(parseKey(plan.startDate), parseKey(plan.endDate));
    return Math.max(1, Math.ceil((days + 1) / 7));
  }

  function weekRange(plan, week) {
    const start = addDays(parseKey(plan.startDate), (week - 1) * 7);
    const end = parseKey(plan.endDate);
    const sixDaysOn = addDays(start, 6);
    return { start: start, end: sixDaysOn < end ? sixDaysOn : end };
  }

  /** Which week `date` falls in, clamped to the plan's bounds. */
  function weekContaining(plan, date) {
    const days = daysBetween(parseKey(plan.startDate), date || new Date());
    return Math.min(Math.max(1, Math.floor(days / 7) + 1), weekCount(plan));
  }

  function weekRangeLabel(plan, week) {
    const range = weekRange(plan, week);
    return monthDay(range.start) + ' – ' + monthDay(range.end);
  }

  // ------------------------------------------------------------- progress

  /** 0–60 red, 61–79 yellow, 80–100 green. */
  function progressBand(percent) {
    if (percent < 61) return 'red';
    if (percent < 80) return 'yellow';
    return 'green';
  }

  /** Category row tints cycle by position, so a category keeps its color. */
  const TINT_COUNT = 6;

  return {
    DAY_LETTERS: DAY_LETTERS,
    DAY_NAMES: DAY_NAMES,
    TINT_COUNT: TINT_COUNT,
    startOfDay: startOfDay,
    addDays: addDays,
    dayKey: dayKey,
    parseKey: parseKey,
    daysBetween: daysBetween,
    weekDays: weekDays,
    isToday: isToday,
    isFuture: isFuture,
    rangeLabel: rangeLabel,
    monthDay: monthDay,
    longDate: longDate,
    weeklyTarget: weeklyTarget,
    isSingleTap: isSingleTap,
    countOn: countOn,
    weeklyTotal: weeklyTotal,
    targetDescription: targetDescription,
    period: period,
    periodTitle: periodTitle,
    timeLabel: timeLabel,
    sortHabits: sortHabits,
    previousSaturday: previousSaturday,
    defaultPlan: defaultPlan,
    weekCount: weekCount,
    weekRange: weekRange,
    weekContaining: weekContaining,
    weekRangeLabel: weekRangeLabel,
    progressBand: progressBand
  };
})();
