import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Regression tests for: "selecting an image in the Create/Edit Product modal
// must not close the modal".
//
// Limitation: this repository has no DOM-testing framework (no jsdom, happy-dom,
// vitest, or testing-library — see package.json), so browser interaction cannot
// be exercised here. These are source-contract tests: they lock the exact code
// properties that guarantee (a) image selection never submits the product form
// and never touches modal state, (b) dialog dismissal is always routed through
// React state, and (c) the modal still closes on successful save but stays open
// on failure. Real-browser verification (headless Chrome driven over CDP) was
// performed separately during development and is reported alongside the fix.
const root = process.cwd();
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');
const dialogSource = read(join('src', 'components', 'ui', 'Dialog.tsx'));
const formSource = read(join('src', 'components', 'products', 'ProductForm.tsx'));
const uploadSource = read(join('src', 'components', 'products', 'ProductImageUpload.tsx'));
const pageSource = read(join('src', 'pages', 'ProductsPage.tsx'));

test('Choose Image does not submit the product form', () => {
  const labelAt = uploadSource.indexOf('Choose Image');
  assert.ok(labelAt !== -1, 'Choose Image button must exist');
  const buttonWindow = uploadSource.slice(Math.max(0, labelAt - 400), labelAt);
  assert.ok(buttonWindow.includes('type="button"'), 'Choose Image must be type="button"');
  assert.ok(!buttonWindow.includes('type="submit"'), 'Choose Image must never be a submit button');
  assert.ok(!uploadSource.includes('type="submit"'), 'image upload field must contain no submit button');
  assert.ok(!uploadSource.includes('requestSubmit'), 'upload field must never trigger implicit submission');
  assert.ok(!uploadSource.includes('method="dialog"'), 'no dialog-closing form semantics allowed');
});

test('file input is type="file" and cannot submit the form', () => {
  const labelAt = uploadSource.indexOf('aria-label="Choose product image"');
  assert.ok(labelAt !== -1, 'file picker input must exist');
  const inputWindow = uploadSource.slice(Math.max(0, labelAt - 400), labelAt);
  assert.ok(inputWindow.includes('type="file"'), 'picker input must be type="file"');
});

test('selecting a file never invokes the product create/update handler', () => {
  assert.ok(!uploadSource.includes('onSubmit('), 'upload field must not call the form submit handler');
  assert.ok(!uploadSource.includes('submitEditor'), 'upload field must not reach the page submit handler');
  assert.ok(!uploadSource.includes('mutate('), 'upload field must not trigger any product mutation');
  // The form-level onSubmit prop has exactly one call site: the real submit.
  assert.equal(formSource.match(/onSubmit\(/g)?.length, 1);
  assert.ok(
    formSource.includes("setValue('image_url', next"),
    'image selection must only write the image_url field',
  );
});

test('selecting a file cannot close the modal', () => {
  assert.ok(!uploadSource.includes('setEditor'), 'upload field must not touch editor state');
  assert.ok(!uploadSource.includes('onClose('), 'upload field must not call any dialog close handler');
});

test('backdrop dismissal ignores clicks bubbling from dialog content', () => {
  const handlerAt = dialogSource.indexOf('const handleBackdropClick');
  assert.ok(handlerAt !== -1, 'Dialog must define a backdrop click handler');
  const handlerBody = dialogSource.slice(handlerAt, dialogSource.indexOf('};', handlerAt));
  assert.ok(
    handlerBody.includes('e.target !== e.currentTarget'),
    'only clicks targeted at the dialog itself may dismiss; bubbled content ' +
      'clicks (e.g. the synthetic (0,0) click from fileInput.click()) must be ignored',
  );
  assert.ok(handlerBody.includes('onClose()'), 'genuine backdrop clicks still dismiss');
});

test('Escape/file-picker dismissal is routed through React, never a native teardown', () => {
  const handlerAt = dialogSource.indexOf('const handleCancel');
  assert.ok(handlerAt !== -1, 'Dialog must define a cancel handler');
  const handlerBody = dialogSource.slice(handlerAt, dialogSource.indexOf('};', handlerAt));
  assert.ok(
    handlerBody.includes('e.target !== e.currentTarget'),
    'cancel events bubbling from descendants (e.g. a dismissed file picker) must not dismiss',
  );
  assert.ok(handlerBody.includes('preventDefault'), 'cancel must prevent the native dialog teardown');
  assert.ok(handlerBody.includes('onClose()'), 'cancel must route through the React close handler');
  assert.ok(dialogSource.includes('onCancel={handleCancel}'), 'cancel handler must be wired to the <dialog>');
});

test('dialog close button never submits a form', () => {
  const labelAt = dialogSource.indexOf('aria-label="Close dialog"');
  assert.ok(labelAt !== -1, 'dialog close button must exist');
  const buttonWindow = dialogSource.slice(Math.max(0, labelAt - 300), labelAt);
  assert.ok(buttonWindow.includes('type="button"'), 'dialog close button must be type="button"');
});

test('saving the product successfully still closes the modal', () => {
  assert.equal(
    pageSource.match(/onSuccess: \(\) => setEditor\(null\)/g)?.length,
    2,
    'both create and update must close the editor on success',
  );
});

test('a failed save leaves the modal open', () => {
  assert.ok(
    pageSource.includes('if (createMutation.isPending || updateMutation.isPending) return;'),
    'editor close must stay guarded while a save is pending',
  );
  assert.ok(
    !/onError[\s\S]{0,200}setEditor\(null\)/.test(pageSource),
    'no error path may close the editor',
  );
  // The only editor closers are the guarded closeEditor and the two
  // success callbacks — nothing else may call setEditor(null).
  assert.equal(pageSource.match(/setEditor\(null\)/g)?.length, 3);
});
