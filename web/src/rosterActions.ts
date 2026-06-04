import { createContext, useContext } from "react";

export interface RosterActions {
  onEditPerson?: (id: string) => void;
}

export const RosterActionsContext = createContext<RosterActions>({});
export const useRosterActions = (): RosterActions => useContext(RosterActionsContext);
