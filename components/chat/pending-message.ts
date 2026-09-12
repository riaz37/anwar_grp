/** sessionStorage key prefix for the one-shot hand-off between the empty-state
 *  composer (which has no conversation yet) and the freshly created
 *  conversation's thread — see ChatShell.handleStartNewChat and ChatThread. */
export const PENDING_MESSAGE_KEY_PREFIX = "chat:pending:";
