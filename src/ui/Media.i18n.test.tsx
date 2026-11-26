/**
 * Tests that the text of the media components and small controls of `src/ui`
 * (A–M) goes through `t()` (decision 19): under a fake language the media
 * grid, its tiles, the placeholder lines, the attach button, the drop frame
 * and the avatar read the fake catalog.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AttachButton } from './AttachButton';
import { Avatar } from './Avatar';
import { DropHighlight } from './DropHighlight';
import { MediaGrid } from './MediaGrid';
import { images, item } from './mediaGridHarness';
import { MediaList } from './MediaList';
import type { MediaItem } from './MediaList';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale } from '../test/i18n';

/** Switch to the fake language, then show {@link ui} under the provider. */
function renderFake(ui: JSX.Element): void {
  installFakeLocale({
    ui: {
      attach_button: { label: 'XX attach' },
      avatar: { alt: 'XX face of {handle}' },
      drop_highlight: { text: 'XX drop here' },
      media_grid: {
        alt_line: 'XX ({number}) {text}',
        more: 'XX {count} extra',
        sensitive_show: 'XX reveal',
      },
      media_list: {
        kind_audio: 'XXAUD',
        kind_file: 'XXFILE',
        kind_gif: 'XXGIF',
        kind_image: 'XXIMG',
        kind_video: 'XXVID',
        no_description: 'XX bare',
        no_usable_link: 'XX no link',
        placeholder: 'XX ({kind} {number}/{total} {description})',
        sensitive: 'XX hidden',
      },
      media_tile: {
        alt: 'XXALT',
        alt_label: 'XX alt text of {number}',
        no_description: 'XX picture without words',
        no_usable_link: 'XX tile no link',
      },
    },
  });
  render(<I18nProvider>{ui}</I18nProvider>);
}

/** A grid over {@link items} that is not sensitive, warned or auto-expanded. */
function grid(items: readonly MediaItem[], sensitive = false): JSX.Element {
  return <MediaGrid autoExpand={false} items={items} sensitive={sensitive} warned={false} />;
}

describe('the media components of src/ui in another language', () => {
  it('words the cover of a sensitive grid from the catalog', () => {
    renderFake(grid(images(1), true));

    expect(screen.getByRole('button', { name: 'XX reveal' })).toBeInTheDocument();
  });

  it('words the +N button, the ALT badge and the open description from the catalog', () => {
    renderFake(grid(images(5)));

    fireEvent.click(screen.getByRole('button', { name: 'XX alt text of 1' }));

    expect(screen.getByRole('button', { name: 'XX 1 extra' })).toHaveTextContent('+1');
    expect(screen.getAllByRole('button', { name: /^XX alt text of/u })).toHaveLength(4);
    expect(screen.getAllByText('XXALT')).toHaveLength(4);
    expect(screen.getByText('XX (1) image 1')).toBeInTheDocument();
  });

  it('words an image without a description and a tile without a link from the catalog', () => {
    renderFake(
      grid([item({ description: null }), item({ id: 'm2', previewUrl: null, url: null })]),
    );

    expect(screen.getByRole('img', { name: 'XX picture without words' })).toBeInTheDocument();
    expect(screen.getByText('XX tile no link')).toBeInTheDocument();
  });

  it('words the placeholder lines, the sensitive mark and a missing link from the catalog', () => {
    renderFake(
      <MediaList
        autoExpand
        items={[
          item({ id: 'a', description: null }),
          item({ id: 'b', type: 'video', description: 'a clip' }),
          item({ id: 'c', type: 'gifv', description: 'a loop' }),
          item({ id: 'd', type: 'audio', description: 'a tune' }),
          item({ id: 'e', type: 'unknown', description: 'a file' }),
          item({ id: 'f', url: null, description: 'gone' }),
        ]}
        sensitive={false}
      />,
    );

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toStrictEqual([
      'XX (XXIMG 1/6 XX bare)',
      'XX (XXVID 2/6 a clip)',
      'XX (XXGIF 3/6 a loop)',
      'XX (XXAUD 4/6 a tune)',
      'XX (XXFILE 5/6 a file)',
      'XX (XXIMG 6/6 gone)',
    ]);
    expect(screen.getByText('XX no link')).toBeInTheDocument();
  });

  it('words the sensitive mark of a placeholder line from the catalog', () => {
    renderFake(<MediaList autoExpand={false} items={[item()]} sensitive />);

    expect(screen.getByText('XX hidden')).toBeInTheDocument();
  });

  it('words the attach button from the catalog', () => {
    renderFake(<AttachButton onAttach={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'XX attach' })).toBeInTheDocument();
  });

  it('words the drop frame from the catalog', () => {
    renderFake(<DropHighlight />);

    expect(screen.getByText('XX drop here')).toBeInTheDocument();
  });

  it('words the avatar’s alt text from the catalog', () => {
    renderFake(<Avatar animate={false} handle="@a@x.example" size="small" src="" staticSrc="" />);

    expect(screen.getByAltText('XX face of @a@x.example')).toBeInTheDocument();
  });
});
