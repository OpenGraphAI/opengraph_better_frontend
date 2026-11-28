// A film's photos must be decoded before it plays, or a frame can slide in
// as an empty grey box on a slow connection. A broken or slow image must not
// hold the film back for long, so failures are ignored and the wait is capped
// (the same rule as the bento trace's photo in src/bento.js).

/**
 * @param {Iterable<{ decode(): Promise<void> }>} images
 * @param {number} timeoutMs  longest the film waits before playing anyway
 */
export function whenImagesReady(images, timeoutMs) {
  const decoded = Promise.all([...images].map((image) => image.decode().catch(() => {})));
  let timer;
  const timeout = new Promise((resolve) => { timer = setTimeout(resolve, timeoutMs); });
  return Promise.race([decoded, timeout]).finally(() => clearTimeout(timer));
}
