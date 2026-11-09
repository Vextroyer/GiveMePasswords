// All user-facing copy, plus the EN/ES dictionary and hydration helpers.
// Static markup carries data-i18n keys; runtime copy goes through t().

export const strings = {
  meta: {
    title: "Monthly Password Generator",
    description:
      "Generate a month of daily 8-digit passwords in your browser. No account, no server, no storage.",
  },

  header: {
    wordmark: "Monthly passwords",
    privacy: "Runs entirely in your browser. Nothing is sent, saved, or tracked.",
  },

  lang: {
    label: "Language",
    en: "English",
    es: "Español",
  },

  landing: {
    title: "A month of daily passwords",
    lede: "Turn one recovery code into a full month of 8-digit passwords. Use the same code next time to get the same list back.",
    createTitle: "Create a new list",
    createCopy: "Start with a fresh recovery code.",
    restoreTitle: "I have a recovery code",
    restoreCopy: "Rebuild a list you saved earlier.",
    risk: "8-digit convenience code — not for high-value accounts.",
  },

  setup: {
    back: "← Back",
  },

  form: {
    month: "Month",
    year: "Year",
    recoveryCode: "Recovery code",
    codePlaceholder: "HPG1-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX",
  },

  create: {
    hint: "The list covers every day in this month. A new list gets a new code, so it will not match an earlier list.",
    submit: "Create list",
  },

  restore: {
    hint: "Hyphens, spaces, and lowercase are fine. The code's checksum catches most typos, but a valid code can still describe a different list.",
    submit: "Show my list",
  },

  headings: {
    create: "Create a new list",
    restore: "I have a recovery code",
  },

  errors: {
    month: "Choose a month.",
    codeEmpty: "Enter the recovery code.",
    codeVersion: "This code is from a different version. Only HPG1 codes work here.",
    codeChar: "The code has a character that is not allowed. Check it against your saved copy.",
    codeLength: "The code is the wrong length. It should have 28 characters after the HPG1 prefix.",
    codeChecksum: "The code's checksum does not match. Re-check it against your saved copy.",
    codeUnknown: "That recovery code could not be read.",
    crypto:
      "This browser cannot generate passwords here. Use a current browser over HTTPS (or localhost).",
    generic: "Something went wrong. Reload the page and try again.",
    monthInvalid: "That month is not valid.",
  },

  mode: {
    create: "New list",
    restore: "Restored from code",
    rotate: "Rotated code",
  },

  list: {
    titleFallback: "Month",
    caption: (label) => `Passwords for ${label}.`,
    printNote: "Generated with HPG-1. Keep this list private.",
    saveSummary: "Your recovery code",
    saveCopy:
      "This is the only way to rebuild this list. Store it in a password manager or print it and keep it somewhere you can find it.",
  },

  actions: {
    copyAll: "Copy all",
    download: "Download .txt",
    print: "Print",
    share: "Share",
    copyCode: "Copy code",
    downloadCode: "Download code",
    rotate: "Rotate code",
    startOver: "Start over",
  },

  table: {
    day: "Day",
    password: "Password",
    copy: "Copy",
    copyColumn: "Copy password",
    copyDay: (day) => `Copy password for day ${day}`,
    today: "Today",
  },

  months: {
    label: (name, year) => `${name} ${year}`,
    "01": "January",
    "02": "February",
    "03": "March",
    "04": "April",
    "05": "May",
    "06": "June",
    "07": "July",
    "08": "August",
    "09": "September",
    10: "October",
    11: "November",
    12: "December",
  },

  export: {
    title: (label, days) => `Monthly passwords — ${label} (${days} days)`,
    algorithm: "Algorithm: HPG-1. Keep this list private.",
    header: "Day  Password",
    end: "End of the list.",
  },

  ceremony: {
    title: "Save your recovery code",
    createIntro:
      "This code is the only way to get this list again. We cannot recover it for you.",
    rotateIntro:
      "This is a new code. Lists made with the old code cannot be recreated from this one.",
    monthReminder: (label) =>
      `Keep this file, or note the month: ${label}. The code alone does not include the month.`,
    confirm: "I have saved this code somewhere I can find it.",
    cancel: "Cancel and discard",
    continue: "Show my list",
  },

  toast: {
    copiedPassword: (day) => `Password for day ${day} copied.`,
    copiedAll: "All passwords copied.",
    copiedCode: "Recovery code copied.",
    listDownloaded: "List downloaded.",
    codeDownloaded: "Recovery code downloaded.",
    copyFailed: "Could not copy automatically. Select the text and copy it manually.",
    shareFailed: "Sharing is not available in this browser.",
    rotated: "New code created. Save it before showing the new list.",
  },

  filenames: {
    list: (month) => `passwords-${month}.txt`,
    code: (month) => `recovery-code-${month}.txt`,
  },

  codeFile: {
    header: () =>
      "HPG1 recovery code\n\n" +
      "Keep this file private. Anyone with this code can derive your passwords.\n\n",
  },

  rotateConfirm:
    "Rotate the code? Lists you already saved stay valid on the router, but this new code will not recreate them. You will need to save the new code.",
};

export const catalogs = {
  en: strings,
  es: {
    meta: {
      title: "Generador de contraseñas mensuales",
      description:
        "Genera un mes de contraseñas diarias de 8 dígitos en tu navegador. Sin cuenta, sin servidor y sin almacenamiento.",
    },

    header: {
      wordmark: "Contraseñas mensuales",
      privacy: "Todo ocurre en tu navegador. No se envía, guarda ni rastrea nada.",
    },

    lang: {
      label: "Idioma",
      en: "English",
      es: "Español",
    },

    landing: {
      title: "Un mes de contraseñas diarias",
      lede: "Convierte un código de recuperación en un mes completo de contraseñas de 8 dígitos. Usa el mismo código la próxima vez para recuperar la misma lista.",
      createTitle: "Crear una lista nueva",
      createCopy: "Empieza con un código de recuperación nuevo.",
      restoreTitle: "Tengo un código de recuperación",
      restoreCopy: "Reconstruye una lista que guardaste antes.",
      risk: "Código de conveniencia de 8 dígitos: no para cuentas de alto valor.",
    },

    setup: {
      back: "← Atrás",
    },

    form: {
      month: "Mes",
      year: "Año",
      recoveryCode: "Código de recuperación",
      codePlaceholder: "HPG1-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX",
    },

    create: {
      hint: "La lista cubre todos los días de este mes. Una lista nueva recibe un código nuevo, así que no coincidirá con una lista anterior.",
      submit: "Crear lista",
    },

    restore: {
      hint: "Los guiones, los espacios y las minúsculas están bien. La suma de verificación detecta la mayoría de los errores de escritura, pero un código válido puede describir otra lista.",
      submit: "Mostrar mi lista",
    },

    headings: {
      create: "Crear una lista nueva",
      restore: "Tengo un código de recuperación",
    },

    errors: {
      month: "Elige un mes.",
      codeEmpty: "Escribe el código de recuperación.",
      codeVersion: "Este código es de otra versión. Solo funcionan los códigos HPG1.",
      codeChar: "El código contiene un carácter no permitido. Compáralo con tu copia guardada.",
      codeLength:
        "El código tiene una longitud incorrecta. Debe tener 28 caracteres después del prefijo HPG1.",
      codeChecksum:
        "La suma de verificación del código no coincide. Revísalo con tu copia guardada.",
      codeUnknown: "No se pudo leer ese código de recuperación.",
      crypto:
        "Este navegador no puede generar contraseñas aquí. Usa un navegador actual con HTTPS (o localhost).",
      generic: "Algo salió mal. Recarga la página e inténtalo de nuevo.",
      monthInvalid: "Ese mes no es válido.",
    },

    mode: {
      create: "Lista nueva",
      restore: "Restaurada desde el código",
      rotate: "Código renovado",
    },

    list: {
      titleFallback: "Mes",
      caption: (label) => `Contraseñas de ${label}.`,
      printNote: "Generado con HPG-1. Mantén esta lista en privado.",
      saveSummary: "Tu código de recuperación",
      saveCopy:
        "Esta es la única forma de reconstruir esta lista. Guárdalo en un gestor de contraseñas o imprímelo y guárdalo donde puedas encontrarlo.",
    },

    actions: {
      copyAll: "Copiar todo",
      download: "Descargar .txt",
      print: "Imprimir",
      share: "Compartir",
      copyCode: "Copiar código",
      downloadCode: "Descargar código",
      rotate: "Renovar código",
      startOver: "Empezar de nuevo",
    },

    table: {
      day: "Día",
      password: "Contraseña",
      copy: "Copiar",
      copyColumn: "Copiar contraseña",
      copyDay: (day) => `Copiar la contraseña del día ${day}`,
      today: "Hoy",
    },

    months: {
      label: (name, year) => `${name} de ${year}`,
      "01": "enero",
      "02": "febrero",
      "03": "marzo",
      "04": "abril",
      "05": "mayo",
      "06": "junio",
      "07": "julio",
      "08": "agosto",
      "09": "septiembre",
      10: "octubre",
      11: "noviembre",
      12: "diciembre",
    },

    export: {
      title: (label, days) => `Contraseñas mensuales — ${label} (${days} días)`,
      algorithm: "Algoritmo: HPG-1. Mantén esta lista en privado.",
      header: "Día  Contraseña",
      end: "Fin de la lista.",
    },

    ceremony: {
      title: "Guarda tu código de recuperación",
      createIntro:
        "Este código es la única forma de recuperar esta lista. No podemos recuperarlo por ti.",
      rotateIntro:
        "Este es un código nuevo. Las listas creadas con el código anterior no se pueden recrear con este.",
      monthReminder: (label) =>
        `Guarda este archivo o anota el mes: ${label}. El código por sí solo no incluye el mes.`,
      confirm: "He guardado este código en un lugar donde puedo encontrarlo.",
      cancel: "Cancelar y descartar",
      continue: "Mostrar mi lista",
    },

    toast: {
      copiedPassword: (day) => `Contraseña del día ${day} copiada.`,
      copiedAll: "Todas las contraseñas copiadas.",
      copiedCode: "Código de recuperación copiado.",
      listDownloaded: "Lista descargada.",
      codeDownloaded: "Código de recuperación descargado.",
      copyFailed:
        "No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.",
      shareFailed: "Compartir no está disponible en este navegador.",
      rotated: "Código nuevo creado. Guárdalo antes de mostrar la lista nueva.",
    },

    filenames: {
      list: (month) => `passwords-${month}.txt`,
      code: (month) => `recovery-code-${month}.txt`,
    },

    codeFile: {
      header: () =>
        "Código de recuperación HPG1\n\n" +
        "Guarda este archivo en privado. Cualquiera que tenga este código puede derivar tus contraseñas.\n\n",
    },

    rotateConfirm:
      "¿Renovar el código? Las listas que ya guardaste siguen siendo válidas en el router, pero este código nuevo no las recreará. Tendrás que guardar el nuevo código.",
  },
};

let locale = "en";

function lookup(tree, key) {
  let value = tree;
  for (const part of key.split(".")) {
    if (!value || typeof value !== "object" || !(part in value)) return undefined;
    value = value[part];
  }
  return value;
}

/** Resolve a locale from navigator.languages or an explicit list. */
export function resolveLocale(languages) {
  const list =
    languages ||
    (typeof navigator !== "undefined" && Array.isArray(navigator.languages)
      ? navigator.languages
      : []);

  for (const tag of list) {
    const normalized = String(tag).toLowerCase();
    if (normalized === "es" || normalized.startsWith("es-")) return "es";
    if (normalized === "en" || normalized.startsWith("en-")) return "en";
  }
  return "en";
}

/** Set the active locale. Unknown values are ignored. */
export function setLocale(next) {
  if (typeof next === "string" && Object.prototype.hasOwnProperty.call(catalogs, next)) {
    locale = next;
  }
  return locale;
}

export function getLocale() {
  return locale;
}

/** Translate a dotted key; dynamic entries are called with the given args. */
export function t(key, ...args) {
  const value = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key);
  if (typeof value === "function") return value(...args);
  return value === undefined ? key : value;
}

/** Hydrate static markup without ever writing HTML. */
export function applyTranslations(root) {
  const scope = root || (typeof document !== "undefined" ? document : null);
  if (!scope) return;

  for (const node of scope.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.getAttribute("data-i18n"));
  }

  for (const node of scope.querySelectorAll("[data-i18n-attr]")) {
    for (const pair of node.getAttribute("data-i18n-attr").split(/\s+/)) {
      const split = pair.indexOf(":");
      if (split < 1) continue;
      const attribute = pair.slice(0, split);
      const key = pair.slice(split + 1);
      node.setAttribute(attribute, t(key));
    }
  }

  const doc = scope.nodeType === 9 ? scope : scope.ownerDocument;
  if (doc && doc.documentElement) doc.documentElement.lang = locale;
}
