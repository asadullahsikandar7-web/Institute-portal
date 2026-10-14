// Side-effect import: must be the FIRST import of any entry point
// (server.js, scripts) so the tenancy plugin is in place before models compile.
import { installTenancy } from "./plugin.js";
installTenancy();
