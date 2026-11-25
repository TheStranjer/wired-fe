/**
 * Where `editFields` used to live: it moved to src/state/editFields (WFE-268)
 * so the edit composer in src/features can build the same request. This
 * re-export is what is left of the old path; delete the file and import the
 * state module directly once the move is committed.
 */

export { editFields } from '../state/editFields';
