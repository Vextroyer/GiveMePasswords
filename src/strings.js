// All user-facing copy that the app inserts at runtime.
// Static markup lives in index.html; this file keeps dynamic strings in one
// place so a future translation or RTL pass has a single entry point.

export const strings = {
  headings: {
    create: "Create a new list",
    restore: "I have a recovery code",
  },

  errors: {
    month: "Choose a month in YYYY-MM format.",
    codeEmpty: "Enter the recovery code.",
    codeVersion: "This code is from a different version. Only HPG1 codes work here.",
    codeChar: "The code has a character that is not allowed. Check it against your saved copy.",
    codeLength: "The code is the wrong length. It should have 28 characters after the HPG1 prefix.",
    codeChecksum: "The code's checksum does not match. Re-check it against your saved copy.",
    codeUnknown: "That recovery code could not be read.",
    crypto:
      "This browser cannot generate passwords here. Use a current browser over HTTPS (or localhost).",
    generic: "Something went wrong. Reload the page and try again.",
    monthInvalid: "That month is not valid. Use four digits, a hyphen, and two digits, for example 2026-11.",
  },

  mode: {
    create: "New list",
    restore: "Restored from code",
    rotate: "Rotated code",
  },

  ceremony: {
    createIntro:
      "This code is the only way to get this list again. We cannot recover it for you.",
    rotateIntro:
      "This is a new code. Lists made with the old code cannot be recreated from this one.",
    step: "Step 1 of 2: save the code. Step 2: show the list.",
    monthReminder: (label) =>
      `Keep this file, or note the month: ${label}. The code alone does not include the month.`,
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
