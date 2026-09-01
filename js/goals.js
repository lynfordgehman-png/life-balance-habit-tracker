/*
 * goals.js — the 12 week goals page, its categories, and the goal editor.
 */
window.App = window.App || {};

App.goals = (function () {
  'use strict';

  const model = App.model;
  const store = App.store;
  const ui = App.ui;

  // Either the category list or one goal's week-by-week breakout.
  let route = { name: 'list', goalId: null };

  function render() {
    if (route.name === 'detail' && !store.goal(route.goalId)) route = { name: 'list', goalId: null };
    if (route.name === 'detail') renderDetail();
    else renderList();
  }

  // ----------------------------------------------------------------- list

  function renderList() {
    const page = ui.el('#page-goals');
    const plan = store.plan();
    const categories = store.categories();

    page.innerHTML =
      '<button type="button" class="plan-bar" id="plan-bar">' +
        '<span>' +
          '<strong>Due ' + ui.esc(model.longDate(model.parseKey(plan.endDate))) + '</strong>' +
          '<small>' + store.weekCount() + ' weeks · week ' + model.weekContaining(plan, new Date()) + ' now</small>' +
        '</span><span class="chevron">›</span>' +
      '</button>' +

      (categories.length
        ? categories.map(function (category, index) {
            const goals = store.goalsIn(category.id);
            return '<section class="goal-group tint-' + (index % model.TINT_COUNT) + '">' +
              '<h3>' + ui.esc(category.name) + '</h3>' +
              (goals.length
                ? goals.map(function (goal) {
                    const done = goal.quests.filter(function (quest) { return quest.isCompleted; }).length;
                    return '<button type="button" class="goal-row" data-goal="' + goal.id + '">' +
                      '<span class="goal-text">' +
                        '<span class="goal-title">' + ui.esc(goal.title) + '</span>' +
                        '<span class="goal-sub">' + (goal.quests.length
                          ? done + ' of ' + goal.quests.length + ' quests done'
                          : 'No quests yet') + '</span>' +
                      '</span><span class="chevron">›</span>' +
                    '</button>';
                  }).join('')
                : '<p class="note">No goals yet</p>') +
            '</section>';
          }).join('')
        : '<p class="note">Goals are filed under categories, so add a category first.</p>');

    page.querySelector('#plan-bar').addEventListener('click', openDueDate);
    page.querySelectorAll('[data-goal]').forEach(function (button) {
      button.addEventListener('click', function () {
        route = { name: 'detail', goalId: button.dataset.goal };
        render();
      });
    });
  }

  // --------------------------------------------------------------- detail

  function renderDetail() {
    const page = ui.el('#page-goals');
    const goal = store.goal(route.goalId);
    const category = store.categories().find(function (item) { return item.id === goal.categoryID; });
    const weeks = [];
    for (let week = 1; week <= store.weekCount(); week += 1) weeks.push(week);

    page.innerHTML =
      '<div class="detail-bar">' +
        '<button type="button" class="btn quiet" id="detail-back">‹ Goals</button>' +
        '<div class="detail-actions">' +
          '<button type="button" class="btn" id="detail-edit">Edit</button>' +
          '<button type="button" class="btn danger" id="detail-delete">Delete</button>' +
        '</div>' +
      '</div>' +
      '<h2 class="detail-title">' + ui.esc(goal.title) + '</h2>' +
      '<p class="detail-meta">' + ui.esc(category ? category.name : '—') + ' · due ' +
        ui.esc(model.longDate(model.parseKey(store.plan().endDate))) + '</p>' +

      weeks.map(function (week) {
        const quests = store.questsInWeek(goal, week);
        return '<section class="week-section">' +
          '<h3><span>Week ' + week + '</span><small>' +
            ui.esc(model.weekRangeLabel(store.plan(), week)) + '</small></h3>' +
          (quests.length
            ? quests.map(function (quest) {
                return '<button type="button" class="quest-row' + (quest.isCompleted ? ' done' : '') + '"' +
                  ' data-quest="' + quest.id + '" aria-pressed="' + quest.isCompleted + '">' +
                  '<span class="checkbox">' + (quest.isCompleted ? '✓' : '') + '</span>' +
                  '<span class="quest-text"><span class="quest-title">' + ui.esc(quest.title) + '</span></span>' +
                '</button>';
              }).join('')
            : '<p class="note">No quest this week</p>') +
        '</section>';
      }).join('');

    page.querySelector('#detail-back').addEventListener('click', function () {
      route = { name: 'list', goalId: null };
      render();
    });
    page.querySelector('#detail-edit').addEventListener('click', function () { openGoalEditor(goal); });
    page.querySelector('#detail-delete').addEventListener('click', function () {
      ui.confirmSheet('Delete Goal', 'Delete “' + goal.title + '” and its quests?', 'Delete', function () {
        route = { name: 'list', goalId: null };
        store.deleteGoal(goal.id);
      });
    });
    page.querySelectorAll('[data-quest]').forEach(function (row) {
      row.addEventListener('click', function () { store.toggleQuest(row.dataset.quest); });
    });
  }

  // ---------------------------------------------------------- goal editor

  function openGoalEditor(goal) {
    const editing = !!goal;
    const categories = store.categories();
    if (!categories.length) {
      ui.confirmSheet('No Categories', 'Add a category before adding a goal.', 'Edit Categories', openCategories);
      return;
    }

    const weekCount = store.weekCount();
    // Working copy, so Cancel really cancels.
    let quests = editing
      ? goal.quests.map(function (quest) { return Object.assign({}, quest); })
      : [];

    ui.openSheet(editing ? 'Edit Goal' : 'New Goal',
      '<label class="field"><span>Goal</span>' +
        '<input type="text" data-field="title" placeholder="e.g. Read the Bible cover to cover" value="' +
        ui.esc(editing ? goal.title : '') + '" autocomplete="off"></label>' +
      '<label class="field"><span>Category</span><select data-field="category">' +
        categories.map(function (category) {
          const selected = editing && category.id === goal.categoryID ? ' selected' : '';
          return '<option value="' + category.id + '"' + selected + '>' + ui.esc(category.name) + '</option>';
        }).join('') +
      '</select></label>' +
      '<p class="hint">Add a quest for each week. Use “All weeks” to repeat one across the whole plan.</p>' +
      '<div data-field="weeks" class="week-editor"></div>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn" data-role="cancel">Cancel</button>' +
        '<button type="button" class="btn primary" data-role="save">' + (editing ? 'Save' : 'Add') + '</button>' +
      '</div>',
      function (body) {
        const weeksHost = body.querySelector('[data-field="weeks"]');

        function populateAllWeeks(title) {
          const trimmed = title.trim();
          if (!trimmed) return;
          for (let week = 1; week <= weekCount; week += 1) {
            const exists = quests.some(function (quest) {
              return quest.week === week && quest.title.trim().toLowerCase() === trimmed.toLowerCase();
            });
            if (!exists) quests.push({ id: store.uuid(), week: week, title: trimmed, isCompleted: false });
          }
          drawWeeks();
        }

        function drawWeeks() {
          let html = '';
          for (let week = 1; week <= weekCount; week += 1) {
            const mine = quests.filter(function (quest) { return quest.week === week; });
            html += '<section class="week-edit"><h4>Week ' + week + '</h4>' +
              mine.map(function (quest) {
                return '<div class="quest-edit">' +
                  '<input type="text" value="' + ui.esc(quest.title) + '" data-quest-input="' + quest.id + '">' +
                  '<button type="button" class="icon-btn" data-copy="' + quest.id + '" title="Copy to all weeks">⧉</button>' +
                  '<button type="button" class="icon-btn danger" data-remove="' + quest.id + '" title="Delete">✕</button>' +
                '</div>';
              }).join('') +
              '<div class="quest-edit">' +
                '<input type="text" placeholder="Add a quest" data-draft="' + week + '">' +
                '<button type="button" class="btn small" data-add="' + week + '">Add</button>' +
                '<button type="button" class="btn small" data-add-all="' + week + '">All weeks</button>' +
              '</div>' +
            '</section>';
          }
          weeksHost.innerHTML = html;

          weeksHost.querySelectorAll('[data-quest-input]').forEach(function (input) {
            input.addEventListener('input', function () {
              const quest = quests.find(function (item) { return item.id === input.dataset.questInput; });
              if (quest) quest.title = input.value;
            });
          });
          weeksHost.querySelectorAll('[data-remove]').forEach(function (button) {
            button.addEventListener('click', function () {
              quests = quests.filter(function (quest) { return quest.id !== button.dataset.remove; });
              drawWeeks();
            });
          });
          weeksHost.querySelectorAll('[data-copy]').forEach(function (button) {
            button.addEventListener('click', function () {
              const quest = quests.find(function (item) { return item.id === button.dataset.copy; });
              if (quest) populateAllWeeks(quest.title);
            });
          });
          weeksHost.querySelectorAll('[data-add]').forEach(function (button) {
            button.addEventListener('click', function () {
              const week = Number(button.dataset.add);
              const input = weeksHost.querySelector('[data-draft="' + week + '"]');
              if (!input.value.trim()) return;
              quests.push({ id: store.uuid(), week: week, title: input.value.trim(), isCompleted: false });
              drawWeeks();
            });
          });
          weeksHost.querySelectorAll('[data-add-all]').forEach(function (button) {
            button.addEventListener('click', function () {
              const input = weeksHost.querySelector('[data-draft="' + button.dataset.addAll + '"]');
              populateAllWeeks(input.value);
            });
          });
        }

        drawWeeks();

        body.querySelector('[data-role="cancel"]').addEventListener('click', ui.closeSheet);
        body.querySelector('[data-role="save"]').addEventListener('click', function () {
          const title = body.querySelector('[data-field="title"]').value;
          const categoryID = body.querySelector('[data-field="category"]').value;
          if (!title.trim()) return;
          if (editing) store.updateGoal(goal.id, title, categoryID, quests);
          else store.addGoal(title, categoryID, quests);
          ui.closeSheet();
        });
      });
  }

  // ----------------------------------------------------------- categories

  function openCategories() {
    function draw(body) {
      const categories = store.categories();
      body.querySelector('[data-field="list"]').innerHTML = categories.map(function (category, index) {
        return '<div class="category-edit">' +
          '<input type="text" value="' + ui.esc(category.name) + '" data-rename="' + category.id + '">' +
          '<span class="count">' + store.goalsIn(category.id).length + '</span>' +
          '<button type="button" class="icon-btn" data-move-up="' + category.id + '"' +
            (index === 0 ? ' disabled' : '') + ' title="Move up">▲</button>' +
          '<button type="button" class="icon-btn" data-move-down="' + category.id + '"' +
            (index === categories.length - 1 ? ' disabled' : '') + ' title="Move down">▼</button>' +
          '<button type="button" class="icon-btn danger" data-delete="' + category.id + '" title="Delete">✕</button>' +
        '</div>';
      }).join('');

      body.querySelectorAll('[data-rename]').forEach(function (input) {
        input.addEventListener('change', function () {
          store.renameCategory(input.dataset.rename, input.value);
        });
      });
      body.querySelectorAll('[data-move-up]').forEach(function (button) {
        button.addEventListener('click', function () {
          store.moveCategory(button.dataset.moveUp, -1);
          draw(body);
        });
      });
      body.querySelectorAll('[data-move-down]').forEach(function (button) {
        button.addEventListener('click', function () {
          store.moveCategory(button.dataset.moveDown, 1);
          draw(body);
        });
      });
      body.querySelectorAll('[data-delete]').forEach(function (button) {
        button.addEventListener('click', function () {
          const category = store.categories().find(function (item) { return item.id === button.dataset.delete; });
          const count = store.goalsIn(category.id).length;
          ui.closeSheet();
          ui.confirmSheet(
            'Delete Category',
            count === 0
              ? 'Delete “' + category.name + '”?'
              : 'Delete “' + category.name + '” and its ' + count + ' goal' + (count === 1 ? '' : 's') + '?',
            'Delete',
            function () {
              store.deleteCategory(category.id);
              openCategories();
            }
          );
        });
      });
    }

    ui.openSheet('Categories',
      '<div data-field="list" class="category-list"></div>' +
      '<div class="quest-edit">' +
        '<input type="text" placeholder="New category" data-field="new-category">' +
        '<button type="button" class="btn small" data-role="add">Add</button>' +
      '</div>' +
      '<p class="hint">The number shows how many goals are filed under each category. Deleting a category deletes its goals.</p>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn primary" data-role="done">Done</button>' +
      '</div>',
      function (body) {
        draw(body);
        body.querySelector('[data-role="add"]').addEventListener('click', function () {
          const input = body.querySelector('[data-field="new-category"]');
          if (!input.value.trim()) return;
          store.addCategory(input.value);
          input.value = '';
          draw(body);
        });
        body.querySelector('[data-role="done"]').addEventListener('click', ui.closeSheet);
      });
  }

  // ------------------------------------------------------------- due date

  function openDueDate() {
    const plan = store.plan();
    ui.openSheet('Due Date',
      '<label class="field"><span>All goals are due</span>' +
        '<input type="date" data-field="due" value="' + plan.endDate + '" min="' + plan.startDate + '"></label>' +
      '<p class="hint" data-field="weeks"></p>' +
      '<div class="sheet-actions">' +
        '<button type="button" class="btn" data-role="reset">Reset to 12 weeks</button>' +
        '<button type="button" class="btn primary" data-role="save">Save</button>' +
      '</div>',
      function (body) {
        const input = body.querySelector('[data-field="due"]');

        function refresh() {
          const preview = { startDate: plan.startDate, endDate: input.value || plan.endDate };
          const weeks = model.weekCount(preview);
          const stranded = store.goals().reduce(function (total, goal) {
            return total + goal.quests.filter(function (quest) { return quest.week > weeks; }).length;
          }, 0);
          body.querySelector('[data-field="weeks"]').textContent =
            'Started ' + model.longDate(model.parseKey(plan.startDate)) + ' · ' + weeks + ' weeks' +
            (stranded ? ' · ' + stranded + ' quest' + (stranded === 1 ? '' : 's') +
              ' sit past this date and stay hidden until you extend it again.' : '');
        }

        input.addEventListener('change', refresh);
        body.querySelector('[data-role="reset"]').addEventListener('click', function () {
          input.value = model.defaultPlan().endDate;
          refresh();
        });
        body.querySelector('[data-role="save"]').addEventListener('click', function () {
          if (!input.value) return;
          store.setDueDate(input.value);
          App.quests.resetWeek();
          ui.closeSheet();
        });
        refresh();
      });
  }

  return {
    render: render,
    openGoalEditor: openGoalEditor,
    openCategories: openCategories,
    openDueDate: openDueDate,
    canAddGoal: function () { return store.categories().length > 0; }
  };
})();
