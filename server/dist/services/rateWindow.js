"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeRateWindow = void 0;
// A small in-memory "N actions per window" limiter, for authenticated writes that are cheap for one
// person but could be abused in bulk (a vendor creating products). Keyed by whatever the caller picks
// (a vendor id). It resets on restart and is per server instance, like the login limiter: acceptable now;
// move to a shared store when the server runs on more than one instance.
function makeRateWindow(maxActions, windowMs) {
    const hits = new Map();
    return {
        // Counts this action and returns true if it is allowed, false if the key is over its limit.
        take(key, now = Date.now()) {
            var _a;
            const recent = ((_a = hits.get(key)) !== null && _a !== void 0 ? _a : []).filter((time) => now - time < windowMs);
            if (recent.length >= maxActions) {
                hits.set(key, recent);
                return false;
            }
            recent.push(now);
            hits.set(key, recent);
            // Keep the map from growing forever with keys that stopped acting.
            if (hits.size > 5000) {
                for (const [existing, times] of hits) {
                    if (times.every((time) => now - time >= windowMs))
                        hits.delete(existing);
                }
            }
            return true;
        },
    };
}
exports.makeRateWindow = makeRateWindow;
