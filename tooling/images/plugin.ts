/**
 * Vite plugin generating the default images of decision 9.
 *
 * The grids in ./definitions.ts are painted with ./pixelArt.ts and encoded
 * with the pure-JavaScript `pngjs` and `jpeg-js` encoders. At build time the
 * files are emitted as `images/<name>` assets, landing next to the bundle in
 * `dist/images/`; the dev server answers `/images/<name>` from memory, so
 * the same URLs work in both modes. The encoders run only in Node: no image
 * bytes enter the JavaScript bundle.
 */
import { encode } from 'jpeg-js';
import { PNG } from 'pngjs';
import type { Plugin } from 'vite';

import { DEFAULT_IMAGES } from './definitions.ts';
import type { DefaultImage } from './definitions.ts';
import { renderPixelArt } from './pixelArt.ts';
import type { PixelImage } from './pixelArt.ts';

/** The path prefix Wired builds its default asset URLs under (WBE-304). */
const IMAGE_PATH = '/images/';

/** Encode one image as PNG: RGBA pixels, lossless. */
function encodePng(image: PixelImage): Uint8Array {
  const png = new PNG({ width: image.width, height: image.height });
  png.data = Buffer.from(image.data);
  return new Uint8Array(PNG.sync.write(png));
}

/** Encode one image as JPEG at quality 85: the format thumbnail.jpg asks for. */
function encodeJpeg(image: PixelImage): Uint8Array {
  const jpeg = encode({ width: image.width, height: image.height, data: image.data }, 85);
  return new Uint8Array(jpeg.data);
}

/** The bytes of one definition, in the format its file name asks for. */
export function encodeImage(definition: DefaultImage): Uint8Array {
  const image = renderPixelArt(definition.rows, definition.palette, definition.scale);
  return definition.name.endsWith('.jpg') ? encodeJpeg(image) : encodePng(image);
}

/** The bundle path of one definition: fixed by the contract (decision 9). */
export function imageFileName(definition: DefaultImage): string {
  return `images/${definition.name}`;
}

/** Write every generated image into the bundle through an asset emitter. */
export function emitDefaultImages(emit: (fileName: string, source: Uint8Array) => void): void {
  for (const definition of DEFAULT_IMAGES) {
    emit(imageFileName(definition), encodeImage(definition));
  }
}

/** The half of an HTTP response the dev middleware touches. */
export type ImageResponse = {
  writeHead(status: number, headers: Record<string, string>): unknown;
  end(body: Uint8Array): unknown;
};

/** Answer a `/images/<name>` request from memory; false means not ours. */
export function serveDefaultImage(url: string, response: ImageResponse): boolean {
  const path = url.split('?', 1)[0] ?? '';
  const name = path.startsWith(IMAGE_PATH) ? path.slice(IMAGE_PATH.length) : '';
  const definition = DEFAULT_IMAGES.find((candidate) => candidate.name === name);
  if (definition === undefined) {
    return false;
  }
  const type = definition.name.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
  response.writeHead(200, { 'Content-Type': type });
  response.end(encodeImage(definition));
  return true;
}

/**
 * Vite plugin that puts the four fixed files of decision 9 into the build,
 * and serves them from memory in dev.
 */
export function defaultImagesPlugin(): Plugin {
  return {
    name: 'wired-default-images',
    generateBundle() {
      emitDefaultImages((fileName, source) => {
        this.emitFile({ type: 'asset', fileName, source });
      });
    },
    configureServer(server) {
      server.middlewares.use((request, reply, next) => {
        if (!serveDefaultImage(request.url ?? '', reply)) {
          next();
        }
      });
    },
  };
}
