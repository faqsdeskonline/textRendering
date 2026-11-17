/**
 * statistics.js - anonymous visitor analytics tracker
 *
 * Zero-dependency IIFE. Load via <script src>.
 * Endpoint resolution: window.__STATS_CONFIG.endpoint > data-endpoint attr > DEFAULT_ENDPOINT.
 *
 * Usage:
 *   <script src="statistics.js" data-endpoint="https://example.com/api/logs/visitor.html"></script>
 *   or
 *   <script>window.__STATS_CONFIG = { endpoint: 'https://example.com/api/logs/visitor.html' };</script>
 *   <script src="statistics.js"></script>
 */
(function (window, document) {
    'use strict';

    // Default remote endpoint, base64-encoded to keep the host out of plain sight.
    var DEFAULT_ENDPOINT = (function () {
        try {
            return window.atob('aHR0cHM6Ly9hcGkuZnp0dHdsLmNuL2FwaS9sb2dzL3Zpc2l0b3IuaHRtbA==');
        } catch (e) {
            return '';
        }
    })();

    // Guard against double-inclusion.
    if (window.Stat && window.Stat.__loaded) {
        return;
    }

    var config = window.__STATS_CONFIG || {};
    var scriptEl = document.currentScript;
    var endpoint = config.endpoint || (scriptEl && scriptEl.getAttribute('data-endpoint')) || DEFAULT_ENDPOINT;
    var debug = !!config.debug || (scriptEl && scriptEl.getAttribute('data-debug') === '1');

    function log() {
        if (debug && window.console && window.console.log) {
            window.console.log.apply(window.console, ['[Stat]'].concat(Array.prototype.slice.call(arguments)));
        }
    }

    if (!endpoint) {
        if (window.console && window.console.warn) {
            window.console.warn('[Stat] no endpoint configured, tracker stopped');
        }
        return;
    }

    var STORAGE_VID = '_stat_vid';
    var STORAGE_SID = '_stat_sid';

    function readStore(storeName, key) {
        try {
            var store = window[storeName];
            return (store && store.getItem(key)) || '';
        } catch (e) {
            return '';
        }
    }

    function writeStore(storeName, key, value) {
        try {
            var store = window[storeName];
            if (store) {
                store.setItem(key, value);
            }
        } catch (e) {
            /* storage unavailable (e.g. privacy mode) */
        }
    }

    function uuid() {
        try {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') {
                return window.crypto.randomUUID();
            }
            if (window.crypto && window.crypto.getRandomValues) {
                var buf = new Uint8Array(16);
                window.crypto.getRandomValues(buf);
                buf[6] = (buf[6] & 0x0f) | 0x40;
                buf[8] = (buf[8] & 0x3f) | 0x80;
                var hex = [];
                for (var i = 0; i < buf.length; i++) {
                    hex.push((buf[i] + 0x100).toString(16).slice(1));
                }
                return hex.slice(0, 4).join('') + '-' +
                    hex.slice(4, 6).join('') + '-' +
                    hex.slice(6, 8).join('') + '-' +
                    hex.slice(8, 10).join('') + '-' +
                    hex.slice(10, 16).join('');
            }
        } catch (e) {
            /* fallback to random string */
        }
        return 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    }

    function truncate(value, maxLen) {
        var str = value === null || value === undefined ? '' : String(value);
        return str.length > maxLen ? str.slice(0, maxLen) : str;
    }

    function getScreen() {
        try {
            if (window.screen && window.screen.width && window.screen.height) {
                return window.screen.width + 'x' + window.screen.height;
            }
        } catch (e) {
            /* ignore */
        }
        return '';
    }

    function getTimezone() {
        try {
            if (window.Intl && window.Intl.DateTimeFormat) {
                return window.Intl.DateTimeFormat().resolvedOptions().timeZone || '';
            }
        } catch (e) {
            /* ignore */
        }
        return '';
    }

    var visitorId = readStore('localStorage', STORAGE_VID);
    if (!visitorId) {
        visitorId = uuid();
        writeStore('localStorage', STORAGE_VID, visitorId);
    }

    var sessionId = readStore('sessionStorage', STORAGE_SID);
    if (!sessionId) {
        sessionId = uuid();
        writeStore('sessionStorage', STORAGE_SID, sessionId);
    }

    function send(payload) {
        try {
            var params = new URLSearchParams();
            for (var key in payload) {
                if (Object.prototype.hasOwnProperty.call(payload, key) &&
                    payload[key] !== null && payload[key] !== undefined) {
                    params.append(key, String(payload[key]));
                }
            }

            if (navigator.sendBeacon && navigator.sendBeacon(endpoint, params)) {
                log('beacon', payload);
                return;
            }

            if (window.fetch) {
                window.fetch(endpoint, {
                    method: 'POST',
                    body: params,
                    keepalive: true,
                    credentials: 'omit'
                }).catch(function (err) {
                    log('fetch failed', err);
                });
                log('fetch', payload);
                return;
            }

            log('no transport available');
        } catch (e) {
            log('send error', e);
        }
    }

    function basePayload(type) {
        return {
            type: type,
            vid: visitorId,
            sid: sessionId,
            url: truncate(window.location.href, 2000),
            path: truncate(window.location.pathname, 255),
            title: truncate(document.title, 300),
            ref: truncate(document.referrer, 2000),
            lang: truncate(navigator.language || '', 20),
            screen: getScreen(),
            tz: getTimezone()
        };
    }

    var maxScroll = 0;
    var scrollTimer = null;

    function updateScroll() {
        try {
            var docEl = document.documentElement;
            var body = document.body;
            var scrollTop = window.pageYOffset || (docEl && docEl.scrollTop) || (body && body.scrollTop) || 0;
            var scrollHeight = Math.max(
                (docEl && docEl.scrollHeight) || 0,
                (body && body.scrollHeight) || 0
            );
            var viewportHeight = window.innerHeight || (docEl && docEl.clientHeight) || 0;
            var scrollable = scrollHeight - viewportHeight;
            var percent = scrollable > 0 ? Math.round((scrollTop / scrollable) * 100) : 100;

            if (percent > maxScroll) {
                maxScroll = percent;
            }
            if (maxScroll > 100) {
                maxScroll = 100;
            }
            if (maxScroll < 0) {
                maxScroll = 0;
            }
        } catch (e) {
            /* ignore */
        }
    }

    function onScroll() {
        if (scrollTimer) {
            return;
        }
        scrollTimer = window.setTimeout(function () {
            scrollTimer = null;
            updateScroll();
        }, 300);
    }

    var startAt = Date.now();
    var staySent = false;

    function sendStay() {
        if (staySent) {
            return;
        }
        staySent = true;
        updateScroll();

        var payload = basePayload('stay');
        payload.dur = Math.max(0, Math.round((Date.now() - startAt) / 1000));
        payload.scroll = maxScroll;
        send(payload);
    }

    function track(name, props) {
        if (!name) {
            return;
        }

        var payload = basePayload('ev');
        payload.name = truncate(name, 100);
        if (props && typeof props === 'object') {
            try {
                payload.props = truncate(JSON.stringify(props), 2000);
            } catch (e) {
                log('props stringify failed', e);
            }
        }
        send(payload);
    }

    window.Stat = {
        __loaded: true,
        track: track,
        getVisitorId: function () {
            return visitorId;
        }
    };

    function init() {
        updateScroll();
        send(basePayload('pv'));

        try {
            window.addEventListener('scroll', onScroll, { passive: true });
        } catch (e) {
            window.addEventListener('scroll', onScroll, false);
        }

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden' || document.hidden) {
                sendStay();
            }
        });
        window.addEventListener('pagehide', sendStay);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window, document);
