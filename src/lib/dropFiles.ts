/**
 * What a paste or a drop carried (WFE-127, WFE-205): the files of a clipboard
 * or drag payload, whether a drag carries files at all, and whether one file
 * is media the instances take an upload for. Shared by the shell's window-wide
 * listeners and the composer pane's own, so both read a payload the same way.
 */

/** The mime types an upload is taken for: an image, a video or audio. */
const MEDIA_TYPE = /^(image|video|audio)\//;

/** The files {@link data} carried; none when it carried nothing. */
export function carriedFiles(data: DataTransfer | null | undefined): readonly File[] {
  return [...(data?.files ?? [])];
}

/** Whether the drag {@link data} describes carries files — the drags worth reacting to. */
export function carriesFiles(data: DataTransfer | null | undefined): boolean {
  return data?.types.includes('Files') ?? false;
}

/** Whether {@link file} is an image, a video or an audio file. */
export function isMedia(file: File): boolean {
  return MEDIA_TYPE.test(file.type);
}
