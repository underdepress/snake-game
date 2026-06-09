// ==UserScript==
// @name         AcWing 剑指Offer 自动追踪
// @namespace    https://github.com/underdepress/acwing-tracker
// @version      2.6
// @description  AcWing提交通过后自动跳转回追踪页标记完成
// @author       underdepress
// @match        https://www.acwing.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var TRACKER_URL = 'https://underdepress.github.io/snake-game/jianzhi-offer-tracker/index.html';
    var notified = false;
    var scanCount = 0;

    var badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;top:0;right:0;background:#4caf50;color:#fff;padding:2px 8px;font-size:11px;z-index:99999;border-radius:0 0 0 6px;font-family:sans-serif;';
    badge.textContent = '追踪已激活';
    document.documentElement.appendChild(badge);

    function log(msg) {
        console.log('[AcWingTracker]', msg);
    }

    function getProblemId() {
        // Try URL first
        var m = location.href.match(/\/problem\/content\/(\d+)/);
        if (m) {
            var pid = parseInt(m[1], 10) ;
            if (pid >= 14 && pid <= 90) return (pid !== 53) ? pid : null;
        }
        // Try submission detail page - look for link back to problem
        var links = document.querySelectorAll('a[href*="/problem/content/"]');
        for (var i = 0; i < links.length; i++) {
            var m2 = links[i].href.match(/\/problem\/content\/(\d+)/);
            if (m2) {
                var pid2 = parseInt(m2[1], 10) ;
                if (pid2 >= 14 && pid2 <= 90) return (pid2 !== 53) ? pid2 : null;
            }
        }
        return null;
    }

    function markDone(problemId) {
        if (notified) return;
        notified = true;
        badge.textContent = '已标记，跳转中...';
        badge.style.background = '#2196f3';
        log('markDone: pid=' + problemId);
        window.location.href = TRACKER_URL + '#done=' + problemId;
    }

    function containsVerdict(text) {
        if (!text) return false;
        var lower = text.toLowerCase();
        if (lower.indexOf('accepted') !== -1) return true;
        if (lower.indexOf('accept') !== -1) return true;
        if (text.indexOf('答案正确') !== -1) return true;
        return false;
    }

    function scanForAccepted() {
        scanCount++;
        if (notified) return;
        // Check document title
        var title = document.title || '';
        if (containsVerdict(title)) {
            log('Detected in title: "' + title + '"');
        }
        // Check body text
        var bodyText = document.body ? (document.body.innerText || document.body.textContent || '') : '';
        if (containsVerdict(bodyText)) {
            log('Detected in body (scan #' + scanCount + '), text sample: ' + bodyText.substring(0, 200));
            var pid = getProblemId();
            if (pid) {
                markDone(pid);
            } else {
                log('Could not determine problem ID. URL: ' + location.href);
                // Dump all links for debugging
                var links = document.querySelectorAll('a[href*="problem"]');
                for (var i = 0; i < Math.min(links.length, 10); i++) {
                    log('  link: ' + links[i].href);
                }
            }
        }
        // Also check inside iframes
        var frames = document.querySelectorAll('iframe');
        for (var i = 0; i < frames.length; i++) {
            try {
                var frameBody = frames[i].contentDocument ? (frames[i].contentDocument.body.innerText || '') : '';
                if (containsVerdict(frameBody)) {
                    log('Detected in iframe #' + i);
                    var pid2 = getProblemId();
                    if (pid2) markDone(pid2);
                    return;
                }
            } catch(e) {}
        }
    }

    log('Script v2.4 loaded. URL: ' + location.href + ' pid: ' + getProblemId());

    // Initial scan
    setTimeout(scanForAccepted, 2000);

    // DOM change watch
    var timer = null;
    var observer = new MutationObserver(function() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(scanForAccepted, 1000);
    });
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });

    // Periodic fallback scan every 5 seconds (catches anything missed by mutation observer)
    setInterval(scanForAccepted, 5000);
})();
