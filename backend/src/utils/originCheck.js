// Shared by the Express CORS config and both Socket.IO servers
// (chatSocket.js, callSocket.js) — one place defining "what counts as a
// local-network dev origin" instead of three copies of the same regex.
// Deliberately permissive (RFC1918 private ranges, not just localhost) so
// a phone/laptop on the same Wi-Fi can reach the dev server during local
// multi-device testing, matching this app's pre-existing localhost-only
// carve-out that already applies regardless of NODE_ENV.
export function isLocalDevHost(hostname) {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  return false;
}
