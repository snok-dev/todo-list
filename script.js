// ----- Grab the parts of the page we need -----
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const list = document.getElementById("task-list");
const countText = document.getElementById("task-count");
const clearDoneButton = document.getElementById("clear-done");
const filterButtons = document.querySelectorAll(".filter");

// ----- The data -----
// Each task looks like: { id: 123, text: "Buy milk", done: false }
let tasks = loadTasks();
let currentFilter = "all";

// Load saved tasks from the browser so they survive a page refresh
function loadTasks() {
  try {
    return JSON.parse(localStorage.getItem("tasks")) || [];
  } catch {
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem("tasks", JSON.stringify(tasks));
  } catch {
    // Saving isn't available (e.g. private browsing) - the list still works
  }
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
    list.innerHTML = '<li class="empty">Nothing here yet</li>';
  }

  visibleTasks.forEach(function (task) {
    const item = document.createElement("li");
    if (task.done) item.classList.add("done");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.addEventListener("change", function () {
      toggleTask(task.id);
    });

    const text = document.createElement("span");
    text.textContent = task.text;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete";
    deleteButton.textContent = "✕";
    deleteButton.title = "Delete task";
    deleteButton.addEventListener("click", function () {
      deleteTask(task.id);
    });

    item.append(checkbox, text, deleteButton);
    list.appendChild(item);
  });

  const left = tasks.filter(function (task) { return !task.done; }).length;
  countText.textContent = left + (left === 1 ? " task left" : " tasks left");
}

// ----- Actions -----
function addTask(text) {
  tasks.push({ id: Date.now(), text: text, done: false });
  saveTasks();
  render();
}

function toggleTask(id) {
  const task = tasks.find(function (t) { return t.id === id; });
  task.done = !task.done;
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

// ----- Respond to the user -----
form.addEventListener("submit", function (event) {
  event.preventDefault(); // stop the page from reloading
  const text = input.value.trim();
  if (text === "") return;
  addTask(text);
  input.value = "";
  input.focus();
});

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
