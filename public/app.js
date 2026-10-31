const $ = selector => document.querySelector(selector);

const loginPanel = $("#login");
const workspace = $("#workspace");

const taskList = $("#tasks");
const message = $("#message");

let socket;

async function api(url, options = {}) {

  const isFormData = options.body instanceof FormData;

  const response = await fetch(url, {

    credentials: "same-origin",

    ...options,

    headers: {
      ...(isFormData
        ? {}
        : { "Content-Type": "application/json" }),

      ...(options.headers || {})
    }
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload.error?.message || "Error de solicitud"
    );
  }

  return payload.data;
}

function notify(text) {
  message.textContent = text;
}

function escapeHtml(value = "") {

  return String(value).replace(
    /[&<>"']/g,

    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

// Produce una tarea.
function renderTask(task) {

  const article = document.createElement("article");

  article.className = "task";

  article.dataset.id = task.id;

  article.innerHTML = `

    <div class="task-top">

      <strong>${escapeHtml(task.title)}</strong>

      <small>
        ID: ${task.id} · Versión: ${task.version}
      </small>

    </div>

    <p>${escapeHtml(task.description)}</p>

    <small>
      Fecha límite:
      ${escapeHtml(task.due_date || "Sin fecha")}
    </small>

    <div class="actions">

      <select class="task-status">

        ${[
          "pendiente",
          "en_progreso",
          "completada"
        ].map(status => `

          <option
            value="${status}"
            ${task.status === status ? "selected" : ""}
          >
            ${status.replace("_", " ")}
          </option>

        `).join("")}

      </select>

      <label class="file-label">

        Adjuntar archivo

        <input
          type="file"
          class="file"
          accept=".pdf,.png,.jpg,.jpeg,.txt"
        >

      </label>

      ${
        task.attachment_name
          ? '<button class="download secondary">Descargar</button>'
          : ""
      }

      <button class="delete danger">
        Eliminar
      </button>

    </div>
  `;

  // Actualiza el estado.
  article
    .querySelector(".task-status")
    .addEventListener("change", async event => {

      try {

        await api(`/api/tasks/${task.id}`, {

          method: "PATCH",

          headers: {
            "If-Match": String(task.version)
          },

          body: JSON.stringify({
            status: event.target.value
          })

        });

        notify("Estado actualizado.");

      } catch (error) {

        notify(error.message);

        await loadTasks();
      }
    });

  // Elimina una tarea.
  article
    .querySelector(".delete")
    .addEventListener("click", async () => {

      if (!confirm("¿Eliminar esta tarea?")) {
        return;
      }

      try {

        await api(`/api/tasks/${task.id}`, {
          method: "DELETE"
        });

        notify("Tarea eliminada.");

        await loadTasks();

      } catch (error) {

        notify(error.message);
      }
    });

  // Subir archivo.
  article
    .querySelector(".file")
    .addEventListener("change", async event => {

      const file = event.target.files[0];

      if (!file) return;

      const formData = new FormData();

      formData.append("file", file);

      try {

        await api(
          `/api/tasks/${task.id}/attachment`,

          {
            method: "POST",
            body: formData
          }
        );

        notify("Archivo adjuntado correctamente.");

        await loadTasks();

      } catch (error) {

        notify(error.message);
      }
    });

  // Descargar archivo.
  article
    .querySelector(".download")
    ?.addEventListener("click", () => {

      window.location.href =
        `/api/tasks/${task.id}/attachment`;
    });

  return article;
}

// Consultar tareas.
async function loadTasks() {

  const params = new URLSearchParams();

  if ($("#filter").value) {
    params.set("status", $("#filter").value);
  }

  if ($("#search").value.trim()) {
    params.set("q", $("#search").value.trim());
  }

  const tasks = await api(
    `/api/tasks?${params.toString()}`
  );

  taskList.replaceChildren();

  if (!tasks.length) {

    taskList.innerHTML = `
      <div class="empty">
        No hay tareas disponibles.
      </div>
    `;

    return;
  }

  tasks.forEach(task => {
    taskList.append(renderTask(task));
  });
}

// Comunicación en tiempo real.
function connectRealtime() {

  if (socket) {
    socket.disconnect();
  }

  socket = io();

  socket.on("connect", () => {

    $("#connection").textContent =
      "Conectado";

    $("#connection").classList.remove("offline");
  });

  socket.on("disconnect", () => {

    $("#connection").textContent =
      "Desconectado";

    $("#connection").classList.add("offline");
  });

  socket.on("connect_error", () => {
    notify("No se pudo establecer la conexión en tiempo real.");
  });

  // Recargar cuando haya cambios.
  [
    "task:created",
    "task:updated",
    "task:deleted"
  ].forEach(event => {

    socket.on(event, () => {

      loadTasks().catch(() => {});
    });

  });
}

// Mostrar panel.
async function showWorkspace() {

  await api("/api/session");

  loginPanel.hidden = true;
  workspace.hidden = false;

  await loadTasks();

  connectRealtime();
}

// Inicio de sesión.
$("#login-form").addEventListener(
  "submit",

  async event => {

    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const credentials = Object.fromEntries(form);

    try {

      await api("/api/session/login", {

        method: "POST",

        body: JSON.stringify(credentials)

      });

      $("#login-error").textContent = "";

      await showWorkspace();

    } catch (error) {

      $("#login-error").textContent = error.message;
    }
  }
);

// Cerrar sesión.
$("#logout").addEventListener(
  "click",

  async () => {

    try {

      await api("/api/session", {
        method: "DELETE"
      });

      socket?.disconnect();

      workspace.hidden = true;
      loginPanel.hidden = false;

    } catch (error) {

      notify(error.message);
    }
  }
);

// Crear tarea.
$("#task-form").addEventListener(
  "submit",

  async event => {

    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const body = Object.fromEntries(form);

    if (!body.due_date) {
      body.due_date = null;
    }

    try {

      await api("/api/tasks", {

        method: "POST",

        body: JSON.stringify(body)

      });

      event.currentTarget.reset();

      notify("Tarea creada correctamente.");

      await loadTasks();

    } catch (error) {

      notify(error.message);
    }
  }
);

// Filtrar por estado.
$("#filter").addEventListener(
  "change",

  () => {
    loadTasks().catch(error => notify(error.message));
  }
);

// Buscar con un pequeño retraso.
let searchTimeout;

$("#search").addEventListener(
  "input",

  () => {

    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {

      loadTasks().catch(error => notify(error.message));

    }, 250);
  }
);

// Comprobar sesión al cargar la página.
showWorkspace().catch(() => {

  loginPanel.hidden = false;
  workspace.hidden = true;

});