/**
 * How the build's `publicView` setting (decision 3) treats one instance, shared
 * by the config layer that works it out and the capabilities layer that
 * combines it with the backend's published policy (decision 5).
 */

/**
 * `force`: signed-out viewing is on, whatever the backend says. `off`: it is
 * off. `backend`: the backend's published policy decides.
 */
export type PublicViewSetting = 'force' | 'off' | 'backend';
