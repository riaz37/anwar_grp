/** Shape the shell needs from a session. Mirrors the session payload described
 *  in BUILD_PLAN.md Sec 2.5 (role + department + business unit). */
export type ShellUser = {
  name: string;
  role: string;
  department: string;
};
