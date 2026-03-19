/**
 * MANUAL TEST CHECKLIST - Goal Input Cursor Behaviour
 *
 * These tests must be verified manually in a browser.
 *
 * 1. Open Settings page.
 * 2. Click the Daily Goal input.
 * 3. Type "2.5" slowly - cursor must NOT jump.
 * 4. Delete back to "2." - cursor must stay at end.
 * 5. Type "25" - value should read "2.25" with cursor after last "5".
 * 6. Click another input - onBlur normalizes value to valid number.
 * 7. Open DevTools, change a Zustand store value externally - input must NOT reset while focused.
 * 8. Repeat all above for Weekly and Monthly inputs.
 */
export {};
