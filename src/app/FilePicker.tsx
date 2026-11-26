/**
 * The hidden file input Root renders for `/attach`, the `[📎]` button and the
 * tray (WFE-126, WFE-287): the browser's own dialog answers it, and whatever
 * the app does with a chosen list is the caller's.
 */
import type { ChangeEvent, JSX, Ref } from 'react';

/** Props of {@link FilePicker}: where the input lives and what a chosen list does. */
export type FilePickerProps = {
  readonly inputRef: Ref<HTMLInputElement>;
  readonly onFiles: (files: readonly File[]) => void;
};

/** The hidden multiple-file input; it is emptied after each choice so the same file can be chosen again. */
export function FilePicker(props: FilePickerProps): JSX.Element {
  const { inputRef, onFiles } = props;
  return (
    <input
      accept="image/*,video/*,audio/*"
      aria-hidden="true"
      hidden
      multiple
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const chosen = input.files === null ? [] : [...input.files];
        input.value = '';
        onFiles(chosen);
      }}
      ref={inputRef}
      tabIndex={-1}
      type="file"
    />
  );
}
