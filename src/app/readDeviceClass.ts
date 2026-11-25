/**
 * The DOM side of device class detection (decision 17): pulls the user agent,
 * platform, client-hint and touch fields off a navigator and hands them to the
 * pure {@link deviceClass}. src/lib stays free of DOM globals.
 */

import { type DeviceClass, deviceClass } from '../lib/deviceClass';

/** The parts of `navigator` that are read; `userAgentData` is Chromium-only and not in lib.dom. */
type NavigatorLike = {
  readonly userAgent: string;
  readonly platform?: string;
  readonly maxTouchPoints?: number;
  readonly userAgentData?: { readonly mobile?: boolean };
};

/** The device class {@link nav} reports. */
export function readDeviceClass(nav: NavigatorLike): DeviceClass {
  return deviceClass({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    mobileHint: nav.userAgentData?.mobile,
  });
}

/** This device's class, read off the real navigator once, when the module loads. */
export const DEVICE_CLASS: DeviceClass = readDeviceClass(navigator);
