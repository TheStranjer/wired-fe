/**
 * Device class detection (decision 17): which of the two saved layouts this
 * device uses. Pure; the caller reads the fields off `navigator` and hands
 * them in, so nothing here touches a DOM global.
 */

/** The two device classes layouts are saved and synced under. */
export type DeviceClass = 'desktop' | 'mobile';

/** What the browser reports about itself; everything but the UA string may be absent. */
export type DeviceInput = {
  readonly userAgent: string;
  readonly platform?: string | undefined;
  /** `navigator.userAgentData.mobile`; wins over every other field when defined. */
  readonly mobileHint?: boolean | undefined;
  readonly maxTouchPoints?: number | undefined;
};

/** User agents and platforms of phones, tablets and iOS devices. */
const MOBILE_PATTERN = /android|iphone|ipod|ipad|ios/i;

/** A Mac as reported by iPadOS 13+ in desktop mode. */
const MAC_PATTERN = /macintosh|macintel/i;

/** Whether {@link input} names a Mac that has a touch screen, i.e. an iPad. */
function isTouchMac(input: DeviceInput): boolean {
  const claimsMac = MAC_PATTERN.test(input.userAgent) || MAC_PATTERN.test(input.platform ?? '');
  return claimsMac && (input.maxTouchPoints ?? 0) > 1;
}

/**
 * The class of the device {@link input} describes: the client hint when there
 * is one, else Android, iPhone, iPod, iPad and touch-screen Macs are `mobile`,
 * and everything else, including the unknown, is `desktop`.
 */
export function deviceClass(input: DeviceInput): DeviceClass {
  if (input.mobileHint !== undefined) {
    return input.mobileHint ? 'mobile' : 'desktop';
  }
  const mobile = MOBILE_PATTERN.test(input.userAgent) || isTouchMac(input);
  return mobile ? 'mobile' : 'desktop';
}
