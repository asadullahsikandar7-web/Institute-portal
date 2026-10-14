import { runAsTenant, runUnscoped } from "./context.js";
import { isMultiTenant, findTenant, defaultTenant } from "./middleware.js";

// Socket.IO events arrive outside any HTTP request, so each socket is tied
// to the institute in its token and every event handler runs inside it.

// Room for "every admin of this institute" (chat list live updates).
export const adminRoom = (user) => `admins:${user?.tenant || "single"}`;

export function scopeSocket(socket) {
  const user = socket.user || {};
  const resolved = (async () => {
    if (!(await isMultiTenant())) return { unscoped: true };
    const t = user.tenant ? await findTenant({ id: user.tenant }) : await defaultTenant();
    return t && t.status === "active" ? { tenant: t } : null;
  })();
  const on = socket.on.bind(socket);
  socket.on = (event, handler) => on(event, async (...args) => {
    const scope = await resolved.catch(() => null);
    if (!scope) {
      const ack = args.find(a => typeof a === "function");
      if (ack) ack({ error: "Institute not available." });
      return socket.disconnect(true);
    }
    return scope.unscoped ? runUnscoped(async () => await handler(...args)) : runAsTenant(scope.tenant, async () => await handler(...args));
  });
}
