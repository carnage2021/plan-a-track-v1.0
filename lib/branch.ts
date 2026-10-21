// Branches (a second kitchen, another city's office). The data is loaded for one branch at a time;
// records with no branch, which is everything made before branches were set up, show in every branch.
// Set while loading, read by the loaders and the code that creates new records.

/* eslint-disable @typescript-eslint/no-explicit-any -- rows come straight from PostgREST */
type Row = Record<string, any>;

let enabled = false;
let active = "";

export function setBranchContext(columnsExist: boolean, branchId: string) {
  enabled = columnsExist;
  active = columnsExist ? branchId : "";
}

/** The branch the app is showing, or "" for all branches. */
export const activeBranch = () => active;

/** True for a row that belongs in the branch being shown. */
export const inBranch = (row: Row) => !active || !row.branch_id || row.branch_id === active;

/** A new record is filed under the branch being shown; with all branches showing it belongs to none. */
export const withBranch = <T extends Row>(row: T): T => (enabled && active ? { ...row, branch_id: active } : row);
