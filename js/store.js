/*
 * store.js — all app data, saved to localStorage.
 * Mutations notify subscribers so the pages re-render.
 */
window.App = window.App || {};

App.store = (function () {
  'use strict';

  const model = App.model;
  const HABITS_KEY = 'lifebalance.habits.v1';
  const GOALS_KEY = 'lifebalance.goals.v1';

  const listeners = [];
  let habits = [];
  let plan = model.defaultPlan();
  let categories = [];
  let goals = [];

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const bytes = new Uint8Array(16);
    (window.crypto || {}).getRandomValues
      ? crypto.getRandomValues(bytes)
      : bytes.forEach(function (_, i) { bytes[i] = Math.floor(Math.random() * 256); });
    return Array.from(bytes).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn('Could not read ' + key, error);
      return fallback;
    }
  }

  function load() {
    habits = read(HABITS_KEY, []);
    const saved = read(GOALS_KEY, null);
    if (saved) {
      plan = saved.plan;
      categories = saved.categories;
      goals = saved.goals;
    } else {
      plan = model.defaultPlan();
      categories = ['Faith', 'Family', 'Fitness', 'Finance'].map(function (name) {
        return { id: uuid(), name: name };
      });
      goals = [];
    }
  }

  function saveHabits() {
    try {
      localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
    } catch (error) {
      console.warn('Could not save habits', error);
    }
    notify();
  }

  function saveGoals() {
    try {
      localStorage.setItem(GOALS_KEY, JSON.stringify({ plan: plan, categories: categories, goals: goals }));
    } catch (error) {
      console.warn('Could not save goals', error);
    }
    notify();
  }

  function notify() {
    listeners.forEach(function (listener) { listener(); });
  }

  // -------------------------------------------------------------- habits

  function sortedHabits() {
    return model.sortHabits(habits);
  }

  function addHabit(name, frequency, targetCount, scheduledMinutes) {
    const trimmed = name.trim();
    if (!trimmed) return;
    habits.push({
      id: uuid(),
      name: trimmed,
      frequency: frequency,
      targetCount: Math.max(1, targetCount),
      scheduledMinutes: scheduledMinutes,
      completions: {},
      createdAt: Date.now()
    });
    saveHabits();
  }

  function updateHabit(id, name, frequency, targetCount, scheduledMinutes) {
    const habit = habits.find(function (item) { return item.id === id; });
    const trimmed = name.trim();
    if (!habit || !trimmed) return;
    habit.name = trimmed;
    habit.frequency = frequency;
    habit.targetCount = Math.max(1, targetCount);
    habit.scheduledMinutes = scheduledMinutes;
    saveHabits();
  }

  function deleteHabit(id) {
    habits = habits.filter(function (habit) { return habit.id !== id; });
    saveHabits();
  }

  function habit(id) {
    return habits.find(function (item) { return item.id === id; }) || null;
  }

  /** One tap: bumps the count, or clears it if a single-tap habit is already done. */
  function tapDay(id, date) {
    const found = habit(id);
    if (!found) return;
    const key = model.dayKey(date);
    const current = found.completions[key] || 0;
    if (model.isSingleTap(found) && current > 0) {
      delete found.completions[key];
    } else {
      found.completions[key] = current + 1;
    }
    saveHabits();
  }

  /** Long press: steps the count back down. */
  function decrementDay(id, date) {
    const found = habit(id);
    if (!found) return;
    const key = model.dayKey(date);
    const current = found.completions[key] || 0;
    if (current <= 1) {
      delete found.completions[key];
    } else {
      found.completions[key] = current - 1;
    }
    saveHabits();
  }

  // ---------------------------------------------------------------- plan

  function weekCount() {
    return model.weekCount(plan);
  }

  function setDueDate(dateKey) {
    plan.endDate = dateKey;
    saveGoals();
  }

  // ---------------------------------------------------------- categories

  function goalsIn(categoryId) {
    return goals
      .filter(function (goal) { return goal.categoryID === categoryId; })
      .sort(function (a, b) { return a.createdAt - b.createdAt; });
  }

  function addCategory(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    categories.push({ id: uuid(), name: trimmed });
    saveGoals();
  }

  function renameCategory(id, name) {
    const trimmed = name.trim();
    const category = categories.find(function (item) { return item.id === id; });
    if (!category || !trimmed) return;
    category.name = trimmed;
    saveGoals();
  }

  /** Removes a category along with every goal filed under it. */
  function deleteCategory(id) {
    categories = categories.filter(function (category) { return category.id !== id; });
    goals = goals.filter(function (goal) { return goal.categoryID !== id; });
    saveGoals();
  }

  function moveCategory(id, offset) {
    const index = categories.findIndex(function (category) { return category.id === id; });
    const target = index + offset;
    if (index < 0 || target < 0 || target >= categories.length) return;
    const [moved] = categories.splice(index, 1);
    categories.splice(target, 0, moved);
    saveGoals();
  }

  // --------------------------------------------------------------- goals

  function goal(id) {
    return goals.find(function (item) { return item.id === id; }) || null;
  }

  function cleanQuests(quests) {
    return quests
      .filter(function (quest) { return quest.title.trim(); })
      .map(function (quest) {
        return {
          id: quest.id || uuid(),
          week: quest.week,
          title: quest.title.trim(),
          isCompleted: !!quest.isCompleted
        };
      })
      .sort(function (a, b) { return a.week - b.week; });
  }

  function addGoal(title, categoryID, quests) {
    const trimmed = title.trim();
    if (!trimmed) return;
    goals.push({
      id: uuid(),
      title: trimmed,
      categoryID: categoryID,
      quests: cleanQuests(quests),
      createdAt: Date.now()
    });
    saveGoals();
  }

  function updateGoal(id, title, categoryID, quests) {
    const found = goal(id);
    const trimmed = title.trim();
    if (!found || !trimmed) return;
    found.title = trimmed;
    found.categoryID = categoryID;
    found.quests = cleanQuests(quests);
    saveGoals();
  }

  function deleteGoal(id) {
    goals = goals.filter(function (item) { return item.id !== id; });
    saveGoals();
  }

  // -------------------------------------------------------------- quests

  function questsInWeek(goal, week) {
    return goal.quests.filter(function (quest) { return quest.week === week; });
  }

  /**
   * A week's quests grouped under their category, skipping categories with none.
   * `index` is the category's position in the full list, which fixes its tint.
   */
  function categoryEntries(week) {
    const groups = [];
    categories.forEach(function (category, index) {
      const entries = [];
      goalsIn(category.id).forEach(function (goal) {
        questsInWeek(goal, week).forEach(function (quest) {
          entries.push({ goal: goal, quest: quest });
        });
      });
      if (entries.length) groups.push({ category: category, index: index, entries: entries });
    });
    return groups;
  }

  function toggleQuest(questId) {
    for (const goal of goals) {
      const quest = goal.quests.find(function (item) { return item.id === questId; });
      if (quest) {
        quest.isCompleted = !quest.isCompleted;
        saveGoals();
        return;
      }
    }
  }

  /** Share of a week's quests that are done, or null when the week has none. */
  function completionRate(week) {
    const quests = categoryEntries(week).reduce(function (all, group) {
      return all.concat(group.entries.map(function (entry) { return entry.quest; }));
    }, []);
    if (!quests.length) return null;
    const done = quests.filter(function (quest) { return quest.isCompleted; }).length;
    return done / quests.length;
  }

  function hasAnyQuests() {
    return goals.some(function (goal) { return goal.quests.length > 0; });
  }

  load();

  return {
    subscribe: function (listener) { listeners.push(listener); },
    uuid: uuid,

    habits: function () { return habits; },
    sortedHabits: sortedHabits,
    habit: habit,
    addHabit: addHabit,
    updateHabit: updateHabit,
    deleteHabit: deleteHabit,
    tapDay: tapDay,
    decrementDay: decrementDay,

    plan: function () { return plan; },
    weekCount: weekCount,
    setDueDate: setDueDate,

    categories: function () { return categories; },
    goalsIn: goalsIn,
    addCategory: addCategory,
    renameCategory: renameCategory,
    deleteCategory: deleteCategory,
    moveCategory: moveCategory,

    goals: function () { return goals; },
    goal: goal,
    addGoal: addGoal,
    updateGoal: updateGoal,
    deleteGoal: deleteGoal,
    questsInWeek: questsInWeek,

    categoryEntries: categoryEntries,
    toggleQuest: toggleQuest,
    completionRate: completionRate,
    hasAnyQuests: hasAnyQuests
  };
})();
