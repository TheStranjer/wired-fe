/**
 * The decision on signed-out viewing (decisions 3 and 5): whether a visitor
 * with no account may see one kind of read, from the build's setting for the
 * instance and the policy the backend published. Pure; nothing reads it yet.
 */
import type {
  AnonymousReadArea,
  AnonymousReadLocality,
  AnonymousReads,
} from '../api/schemas/anonymousReads';
import type { PublicViewSetting } from '../lib/publicViewSetting';

/** Whether the read is allowed, and whether the build forced it against the backend's `false`. */
type PublicViewDecision = {
  readonly allowed: boolean;
  /** True when the setting is `force` and the backend published `false` for this read. */
  readonly conflict: boolean;
};

/**
 * Decides whether a signed-out visitor may see the {@link read} (its `area`
 * and `locality`). `off` never allows. `force` always allows, flagging a
 * `conflict` when the backend published `false`. `backend` allows unless the
 * backend published `false`: an unpublished value (null) counts as allowed,
 * following Pleroma's default.
 */
export function decidePublicView(
  setting: PublicViewSetting,
  reads: AnonymousReads,
  read: { readonly area: AnonymousReadArea; readonly locality: AnonymousReadLocality },
): PublicViewDecision {
  const restricted = reads[read.area][read.locality] === false;
  switch (setting) {
    case 'off':
      return { allowed: false, conflict: false };
    case 'force':
      return { allowed: true, conflict: restricted };
    case 'backend':
      return { allowed: !restricted, conflict: false };
  }
}
