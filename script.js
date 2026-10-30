// ----- Grab the parts of the page we need -----
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const countText = document.getElementById("task-count");
const clearDoneButton = document.getElementById("clear-done");
const filterButtons = document.querySelectorAll(".filter");

// The extra options (due date, duration, repeat)
const toggleOptionsButton = document.getElementById("toggle-options");
const optionsBox = document.getElementById("options");
const dueInput = document.getElementById("due-input");
const durationAmountInput = document.getElementById("duration-amount");
const durationUnitSelect = document.getElementById("duration-unit");
const repeatSelect = document.getElementById("repeat-select");
const customRepeatBox = document.getElementById("custom-repeat");
const repeatEveryInput = document.getElementById("repeat-every");
const repeatUnitSelect = document.getElementById("repeat-unit");
const untilLabel = document.getElementById("until-label");
const untilInput = document.getElementById("until-input");

// ----- The data -----
// Each task looks like:
// {
//   id: 123,
//   text: "Water the plants",
//   done: false,
//   dueDate: "2026-11-02",            // or null
//   durationMinutes: 30,              // how long it takes, or null
//   repeat: { every: 2, unit: "day", until: null },  // or null
//   subtasks: [{ id: 456, text: "Fill the can", done: false }],
//   showSubtasks: false
// }
let tasks = loadTasks();
let currentFilter = "all";

// Load saved tasks from the browser so they survive a page refresh
function loadTasks() {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem("tasks")) || [];
  } catch {
    saved = [];
  }
  // Tasks saved by the older version don't have the new fields, so fill them in
  return saved.map(function (task) {
    return {
      id: task.id,
      text: task.text,
      done: task.done,
      dueDate: task.dueDate || null,
      durationMinutes: task.durationMinutes || null,
      repeat: task.repeat || null,
      subtasks: task.subtasks || [],
      showSubtasks: task.showSubtasks || false
    };
  });
}

function saveTasks() {
  try {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  } catch {
    // Saving isn't available (e.g. private browsing) - the list still works
  }
}

// ----- Date helpers -----
// Dates are stored as text like "2026-11-02" so they're easy to save

function todayString() {
  return toDateString(new Date());
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function fromDateString(text) {
  const parts = text.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

// Move a date forward by e.g. 2 days, 1 week or 3 months
function addInterval(dateText, every, unit) {
  const date = fromDateString(dateText);
  if (unit === "day") {
    date.setDate(date.getDate() + every);
  } else if (unit === "week") {
    date.setDate(date.getDate() + every * 7);
  } else if (unit === "month") {
    const day = date.getDate();
    date.setDate(1); // avoid e.g. Jan 31 + 1 month jumping into March
    date.setMonth(date.getMonth() + every);
    const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDayOfMonth));
  }
  return toDateString(date);
}

// Show a date in a friendly way: "Today", "Tomorrow" or "Mon, Nov 2"
function formatDate(dateText) {
  const today = todayString();
  if (dateText === today) return "Today";
  if (dateText === addInterval(today, 1, "day")) return "Tomorrow";
  if (dateText === addInterval(today, -1, "day")) return "Yesterday";
  return fromDateString(dateText).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric"
  });
}

// ----- Other helpers -----

// 90 -> "1 h 30 min"
function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return mins + " min";
  if (mins === 0) return hours + " h";
  return hours + " h " + mins + " min";
}

// { every: 1, unit: "week" } -> "Every week", { every: 3, unit: "day" } -> "Every 3 days"
function formatRepeat(repeat) {
  if (repeat.every === 1) return "Every " + repeat.unit;
  return "Every " + repeat.every + " " + repeat.unit + "s";
}

function findTask(id) {
  return tasks.find(function (t) { return t.id === id; });
}

// A small helper to make a page element with a class and some text
function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// ----- Draw the list on the page -----
function render() {
  list.innerHTML = "";

  const visibleTasks = tasks.filter(function (task) {
    if (currentFilter === "active") return !task.done;
    if (currentFilter === "done") return task.done;
    return true;
  });

  if (visibleTasks.length === 0) {
    list.appendChild(make("li", "empty", "Nothing here yet"));
  }

  visibleTasks.forEach(function (task) {
    list.appendChild(renderTask(task));
  });

  // Footer: how many tasks are left, and roughly how long they'll take
  const remaining = tasks.filter(function (task) { return !task.done; });
  let summary = remaining.length + (remaining.length === 1 ? " task left" : " tasks left");
  const totalMinutes = remaining.reduce(function (sum, task) {
    return sum + (task.durationMinutes || 0);
  }, 0);
  if (totalMinutes > 0) summary += " · about " + formatDuration(totalMinutes);
  countText.textContent = summary;
}

function renderTask(task) {
  const item = make("li", "task");
  if (task.done) item.classList.add("done");

  // --- The main row: checkbox, text + details, buttons ---
  const row = make("div", "task-row");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.done;
  checkbox.title = task.repeat && !task.done ? "Done - move to next time" : "Mark as done";
  checkbox.addEventListener("change", function () {
    toggleTask(task.id);
  });

  const main = make("div", "task-main");
  main.appendChild(make("div", "task-text", task.text));

  // Little labels underneath the task text
  const meta = make("div", "meta");
  if (task.dueDate) {
    const due = make("span", "badge", "📅 " + formatDate(task.dueDate));
    if (!task.done && task.dueDate < todayString()) due.classList.add("overdue");
    meta.appendChild(due);
  }
  if (task.durationMinutes) {
    meta.appendChild(make("span", "badge", "⏱ " + formatDuration(task.durationMinutes)));
  }
  if (task.repeat) {
    let repeatText = "🔁 " + formatRepeat(task.repeat);
    if (task.repeat.until) repeatText += " until " + formatDate(task.repeat.until);
    meta.appendChild(make("span", "badge repeat", repeatText));
  }
  if (task.subtasks.length > 0) {
    const doneCount = task.subtasks.filter(function (s) { return s.done; }).length;
    meta.appendChild(make("span", "badge", "☑ " + doneCount + "/" + task.subtasks.length));
  }
  if (meta.children.length > 0) main.appendChild(meta);

  const subtaskToggle = make("button", "subtask-toggle", task.showSubtasks ? "Subtasks ▴" : "Subtasks ▾");
  subtaskToggle.addEventListener("click", function () {
    task.showSubtasks = !task.showSubtasks;
    saveTasks();
    render();
  });

  const deleteButton = make("button", "delete", "✕");
  deleteButton.title = "Delete task";
  deleteButton.addEventListener("click", function () {
    deleteTask(task.id);
  });

  row.append(checkbox, main, subtaskToggle, deleteButton);
  item.appendChild(row);

  // --- The subtasks, only shown when opened ---
  if (task.showSubtasks) {
    const subList = make("ul", "subtasks");

    task.subtasks.forEach(function (subtask) {
      const subItem = make("li", "subtask");
      if (subtask.done) subItem.classList.add("done");

      const subCheckbox = document.createElement("input");
      subCheckbox.type = "checkbox";
      subCheckbox.checked = subtask.done;
      subCheckbox.addEventListener("change", function () {
        subtask.done = !subtask.done;
        saveTasks();
        render();
      });

      const subDelete = make("button", "delete", "✕");
      subDelete.title = "Delete subtask";
      subDelete.addEventListener("click", function () {
        task.subtasks = task.subtasks.filter(function (s) { return s.id !== subtask.id; });
        saveTasks();
        render();
      });

      subItem.append(subCheckbox, make("span", "", subtask.text), subDelete);
      subList.appendChild(subItem);
    });
    item.appendChild(subList);

    // A small form to add a new subtask
    const subForm = make("form", "subtask-form");
    const subInput = document.createElement("input");
    subInput.type = "text";
    subInput.placeholder = "Add a subtask";
    subInput.dataset.subtaskInputFor = task.id;
    const subAdd = make("button", "", "Add");
    subAdd.type = "submit";
    subForm.append(subInput, subAdd);
    subForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const text = subInput.value.trim();
      if (text === "") return;
      task.subtasks.push({ id: Date.now(), text: text, done: false });
      saveTasks();
      render();
      // Put the cursor back in the box so you can type the next subtask
      document.querySelector('[data-subtask-input-for="' + task.id + '"]').focus();
    });
    item.appendChild(subForm);
  }

  return item;
}

// ----- Actions -----

// Read the extra options from the form. Returns the repeat settings, or null.
function readRepeatOptions() {
  const choice = repeatSelect.value;
  if (choice === "none") return null;

  let repeat;
  if (choice === "daily") repeat = { every: 1, unit: "day" };
  else if (choice === "weekly") repeat = { every: 1, unit: "week" };
  else if (choice === "monthly") repeat = { every: 1, unit: "month" };
  else {
    repeat = {
      every: Math.max(1, parseInt(repeatEveryInput.value, 10) || 1),
      unit: repeatUnitSelect.value
    };
  }
  repeat.until = untilInput.value || null;
  return repeat;
}

function readDurationMinutes() {
  const amount = parseFloat(durationAmountInput.value);
  if (!amount || amount <= 0) return null;
  if (durationUnitSelect.value === "hour") return Math.round(amount * 60);
  return Math.round(amount);
}

function addTask(text) {
  const repeat = readRepeatOptions();
  let dueDate = dueInput.value || null;
  // A repeating task needs a date to count from, so start from today
  if (repeat && !dueDate) dueDate = todayString();

  tasks.push({
    id: Date.now(),
    text: text,
    done: false,
    dueDate: dueDate,
    durationMinutes: readDurationMinutes(),
    repeat: repeat,
    subtasks: [],
    showSubtasks: false
  });
  saveTasks();
  render();
}

function toggleTask(id) {
  const task = findTask(id);

  // Ticking off a repeating task moves it to its next date instead of finishing it
  if (!task.done && task.repeat) {
    let next = addInterval(task.dueDate, task.repeat.every, task.repeat.unit);
    // If it was overdue, skip ahead past today
    while (next <= todayString()) {
      next = addInterval(next, task.repeat.every, task.repeat.unit);
    }

    if (task.repeat.until && next > task.repeat.until) {
      task.done = true; // no more repeats left - it's finished for good
    } else {
      task.dueDate = next;
      task.subtasks.forEach(function (s) { s.done = false; }); // fresh start next time
    }
  } else {
    task.done = !task.done;
  }

  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = tasks.filter(function (t) { return t.id !== id; });
  saveTasks();
  render();
}

function clearDone() {
  tasks = tasks.filter(function (t) { return !t.done; });
  saveTasks();
  render();
}

function resetOptions() {
  dueInput.value = "";
  durationAmountInput.value = "";
  durationUnitSelect.value = "min";
  repeatSelect.value = "none";
  repeatEveryInput.value = "2";
  repeatUnitSelect.value = "day";
  untilInput.value = "";
  updateRepeatFields();
}

// Show the "custom" and "stop after" fields only when they make sense
function updateRepeatFields() {
  customRepeatBox.hidden = repeatSelect.value !== "custom";
  untilLabel.hidden = repeatSelect.value === "none";
}

// ----- Respond to the user -----
form.addEventListener("submit", function (event) {
  event.preventDefault(); // stop the page from reloading
  const text = input.value.trim();
  if (text === "") return;
  addTask(text);
  input.value = "";
  resetOptions();
  input.focus();
});

toggleOptionsButton.addEventListener("click", function () {
  optionsBox.hidden = !optionsBox.hidden;
  toggleOptionsButton.textContent = optionsBox.hidden
    ? "+ Due date, duration & repeat"
    : "− Hide options";
});

repeatSelect.addEventListener("change", updateRepeatFields);

clearDoneButton.addEventListener("click", clearDone);

filterButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    filterButtons.forEach(function (b) { b.classList.remove("active"); });
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    render();
  });
});

// Draw the list for the first time
render();
