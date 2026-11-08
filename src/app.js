// Browser wiring for the Monthly Password Generator.
//
// This file owns the DOM only. Derivation lives in derive.js, the recovery-code
// format in recovery-code.js, and month assembly in session.js. Nothing here
// persists, requests, or injects HTML: all dynamic values go through
// textContent.

import {
  createSession,
  currentMonth,
  isValidMonth,
  restoreSession,
  sessionToText,
} from "./session.js";
import { strings as t } from "./strings.js";

const el = (id) => document.getElementById(id);

const VIEWS = ["landing", "setup", "list"];
const state = {
  session: null,
  pending: null,
  pendingReason: "create",
};

// ---------------------------------------------------------------------------
// View and form helpers
// ---------------------------------------------------------------------------

function showView(name, focusId) {
  for (const view of VIEWS) {
    el(`view-${view}`).hidden = view !== name;
  }
  window.scrollTo(0, 0);
  if (focusId) {
    el(focusId).focus();
  }
}

function setError(target, message) {
  if (!message) {
    target.textContent = "";
    target.hidden = true;
    return;
  }
  target.textContent = message;
  target.hidden = false;
}

function setBusy(button, busy) {
  button.disabled = busy;
  button.setAttribute("aria-busy", busy ? "true" : "false");
}

function openSetup(mode) {
  el("create-form").hidden = mode !== "create";
  el("restore-form").hidden = mode !== "restore";
  el("setup-title").textContent = t.headings[mode];
  setError(el("create-error"), "");
  setError(el("restore-error"), "");
  showView("setup", mode === "create" ? "create-month" : "restore-month");
}

function populateYearOptions(select) {
  const current = new Date().getFullYear();
  select.replaceChildren();
  for (let year = current - 1; year <= current + 2; year += 1) {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    select.append(option);
  }
}

function setMonthInputs(prefix, month) {
  const [year, monthNumber] = month.split("-");
  el(`${prefix}-month`).value = monthNumber;
  el(`${prefix}-year`).value = year;
}

function readMonthInput(prefix) {
  return `${el(`${prefix}-year`).value}-${el(`${prefix}-month`).value}`;
}

function canDerive() {
  return Boolean(
    globalThis.crypto &&
      typeof globalThis.crypto.getRandomValues === "function" &&
      globalThis.crypto.subtle,
  );
}

function codeErrorMessage(error) {
  switch (error && error.reason) {
    case "EMPTY":
      return t.errors.codeEmpty;
    case "BAD_VERSION":
      return t.errors.codeVersion;
    case "BAD_CHAR":
      return t.errors.codeChar;
    case "BAD_LENGTH":
      return t.errors.codeLength;
    case "BAD_CHECKSUM":
      return t.errors.codeChecksum;
    default:
      return t.errors.codeUnknown;
  }
}

// ---------------------------------------------------------------------------
// Ceremony: the list is not revealed until the code is saved
// ---------------------------------------------------------------------------

function openCeremony(session, reason) {
  state.pending = session;
  state.pendingReason = reason;

  el("ceremony-intro").textContent =
    reason === "rotate" ? t.ceremony.rotateIntro : t.ceremony.createIntro;
  el("ceremony-code").textContent = session.recoveryCode;
  el("ceremony-month-reminder").textContent = t.ceremony.monthReminder(
    session.monthLabel,
  );
  el("ceremony-confirm").checked = false;
  el("ceremony-continue").disabled = true;

  if (!el("ceremony").open) {
    el("ceremony").showModal();
  }
  el("ceremony-confirm").focus();
}

function closeCeremony(value) {
  if (el("ceremony").open) {
    el("ceremony").close(value);
  }
}

// ---------------------------------------------------------------------------
// List rendering
// ---------------------------------------------------------------------------

function buildRow(entry, todayMonth, todayDay) {
  const row = document.createElement("tr");
  const isToday = entry.month === todayMonth && entry.day === todayDay;

  const dayCell = document.createElement("th");
  dayCell.scope = "row";
  dayCell.textContent = String(entry.day).padStart(2, "0");
  if (isToday) {
    row.classList.add("today");
    const badge = document.createElement("span");
    badge.className = "today-badge";
    badge.textContent = "Today";
    dayCell.append(badge);
  }

  const passwordCell = document.createElement("td");
  passwordCell.className = "password";
  const password = document.createElement("code");
  password.textContent = entry.password;
  passwordCell.append(password);

  const actionCell = document.createElement("td");
  actionCell.className = "no-print";
  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "copy-button";
  copyButton.textContent = "Copy";
  copyButton.setAttribute("aria-label", `Copy password for day ${entry.day}`);
  copyButton.dataset.day = String(entry.day);
  actionCell.append(copyButton);

  row.append(dayCell, passwordCell, actionCell);
  return row;
}

function showList(session, mode) {
  state.session = session;

  el("list-title").textContent = session.monthLabel;
  el("list-mode").textContent = t.mode[mode] || t.mode.create;
  el("list-caption").textContent = `Passwords for ${session.monthLabel}.`;
  el("list-code").textContent = session.recoveryCode;

  const now = new Date();
  const todayMonth = currentMonth(now);
  const todayDay = now.getDate();

  const body = el("list-body");
  body.replaceChildren();
  for (const entry of session.days) {
    body.append(buildRow({ ...entry, month: session.month }, todayMonth, todayDay));
  }

  el("save-code").open = false;
  el("share").hidden = typeof navigator.share !== "function";
  showView("list", "list-title");
}

// ---------------------------------------------------------------------------
// Clipboard, download, share, toast
// ---------------------------------------------------------------------------

async function copyText(text) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to a selection copy below.
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.className = "visually-hidden";
  document.body.append(area);
  area.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}

async function copyWithToast(text, message) {
  const copied = await copyText(text);
  toast(copied ? message : t.toast.copyFailed, copied ? 3200 : 6000);
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function codeFile(session) {
  return `${t.codeFile.header()}${session.recoveryCode}\n`;
}

async function shareList() {
  if (!state.session) return;

  const text = sessionToText(state.session);
  const title = state.session.monthLabel;
  const filename = t.filenames.list(state.session.month);

  try {
    if (typeof navigator.canShare === "function") {
      const file = new File([text], filename, { type: "text/plain" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }
    }
    await navigator.share({ title, text });
  } catch (error) {
    if (!error || error.name !== "AbortError") {
      toast(t.toast.shareFailed);
    }
  }
}

let toastTimer = 0;

function toast(message, duration = 3200) {
  const target = el("toast");
  target.textContent = message;
  target.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    target.classList.remove("show");
    target.textContent = "";
  }, duration);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function handleCreate(event) {
  event.preventDefault();
  setError(el("create-error"), "");

  const month = readMonthInput("create");
  if (!isValidMonth(month)) {
    setError(el("create-error"), t.errors.monthInvalid);
    el("create-month").focus();
    return;
  }
  if (!canDerive()) {
    setError(el("create-error"), t.errors.crypto);
    return;
  }

  setBusy(el("create-submit"), true);
  try {
    const seed = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const session = await createSession(seed, month);
    openCeremony(session, "create");
  } catch (error) {
    setError(el("create-error"), t.errors.generic);
  } finally {
    setBusy(el("create-submit"), false);
  }
}

async function handleRestore(event) {
  event.preventDefault();
  setError(el("restore-error"), "");

  const month = readMonthInput("restore");
  const code = el("restore-code").value.trim();

  if (!isValidMonth(month)) {
    setError(el("restore-error"), t.errors.monthInvalid);
    el("restore-month").focus();
    return;
  }
  if (!code) {
    setError(el("restore-error"), t.errors.codeEmpty);
    el("restore-code").focus();
    return;
  }
  if (!canDerive()) {
    setError(el("restore-error"), t.errors.crypto);
    return;
  }

  setBusy(el("restore-submit"), true);
  try {
    const session = await restoreSession(code, month);
    showList(session, "restore");
  } catch (error) {
    setError(el("restore-error"), codeErrorMessage(error));
  } finally {
    setBusy(el("restore-submit"), false);
  }
}

function rotateCode() {
  if (!state.session) return;
  if (!window.confirm(t.rotateConfirm)) return;
  if (!canDerive()) {
    toast(t.errors.crypto);
    return;
  }

  const month = state.session.month;
  try {
    const seed = globalThis.crypto.getRandomValues(new Uint8Array(16));
    createSession(seed, month)
      .then((session) => openCeremony(session, "rotate"))
      .catch(() => toast(t.errors.generic));
  } catch {
    toast(t.errors.generic);
  }
}

function startOver() {
  state.session = null;
  state.pending = null;
  el("list-body").replaceChildren();
  el("list-code").textContent = "";
  el("restore-code").value = "";
  setError(el("create-error"), "");
  setError(el("restore-error"), "");
  showView("landing", "landing-title");
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function init() {
  const month = currentMonth();
  for (const id of ["create-year", "restore-year"]) {
    populateYearOptions(el(id));
  }
  setMonthInputs("create", month);
  setMonthInputs("restore", month);

  el("door-create").addEventListener("click", () => openSetup("create"));
  el("door-restore").addEventListener("click", () => openSetup("restore"));
  el("setup-back").addEventListener("click", () => {
    setError(el("create-error"), "");
    setError(el("restore-error"), "");
    showView("landing", "landing-title");
  });

  el("create-form").addEventListener("submit", handleCreate);
  el("restore-form").addEventListener("submit", handleRestore);

  el("ceremony-confirm").addEventListener("change", (event) => {
    el("ceremony-continue").disabled = !event.target.checked;
  });

  el("ceremony-copy").addEventListener("click", () => {
    if (state.pending) {
      copyWithToast(state.pending.recoveryCode, t.toast.copiedCode);
    }
  });

  el("ceremony-download").addEventListener("click", () => {
    if (!state.pending) return;
    download(t.filenames.code(state.pending.month), codeFile(state.pending));
    toast(t.toast.codeDownloaded);
  });

  el("ceremony-cancel").addEventListener("click", () => closeCeremony("cancel"));

  el("ceremony").addEventListener("close", () => {
    // Covers Escape and the Cancel button. Continue clears pending first.
    state.pending = null;
  });

  el("ceremony-continue").addEventListener("click", () => {
    if (!el("ceremony-confirm").checked || !state.pending) return;

    const session = state.pending;
    const reason = state.pendingReason;
    state.pending = null;
    closeCeremony("continue");
    showList(session, reason);
    if (reason === "rotate") {
      toast(t.toast.rotated);
    }
  });

  el("list-body").addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !state.session) return;

    const button = target.closest("button[data-day]");
    if (!button) return;

    const day = Number(button.dataset.day);
    const entry = state.session.days.find((item) => item.day === day);
    if (!entry) return;

    copyWithToast(entry.password, t.toast.copiedPassword(day));
  });

  el("copy-all").addEventListener("click", () => {
    if (state.session) {
      copyWithToast(sessionToText(state.session), t.toast.copiedAll);
    }
  });

  el("download-txt").addEventListener("click", () => {
    if (!state.session) return;
    download(
      t.filenames.list(state.session.month),
      sessionToText(state.session),
    );
    toast(t.toast.listDownloaded);
  });

  el("print").addEventListener("click", () => window.print());
  el("share").addEventListener("click", shareList);

  el("copy-code").addEventListener("click", () => {
    if (state.session) {
      copyWithToast(state.session.recoveryCode, t.toast.copiedCode);
    }
  });

  el("download-code").addEventListener("click", () => {
    if (!state.session) return;
    download(t.filenames.code(state.session.month), codeFile(state.session));
    toast(t.toast.codeDownloaded);
  });

  el("rotate").addEventListener("click", rotateCode);
  el("start-over").addEventListener("click", startOver);

  showView("landing");
}

init();
