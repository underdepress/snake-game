// ==UserScript==
// @name         AcWing 剑指Offer 自动追踪
// @namespace    https://github.com/underdepress/acwing-tracker
// @version      2.2
// @description  AcWing提交通过后自动通知追踪页标记完成（postMessage，无需服务器）
// @author       underdepress
// @match        https://www.acwing.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var notified = false;

    // Show a small badge so we know the script is active
    var badge = document.createElement('div');
    badge.style.cssText = 'position:fixed;top:0;right:0;background:#4caf50;color:#fff;padding:2px 8px;font-size:11px;z-index:99999;border-radius:0 0 0 6px;font-family:sans-serif;';
    badge.textContent = '✓ 追踪已激活';
    document.documentElement.appendChild(badge);

    function log(msg) {
        console.log('[AcWingTracker]', msg);
    }

    function getProblemId() {
        // Try from URL first
        var m = location.href.match(/\/problem\/content\/(\d+)/);
        if (m) {
            var pid = parseInt(m[1], 10) - 1;
            if (pid >= 13 && pid <= 88) return pid;
        }
        // Try to find problem link on submission detail page
        var link = document.querySelector('a[href*="/problem/content/"]');
        if (link) {
            var m2 = link.href.match(/\/problem\/content\/(\d+)/);
            if (m2) {
                var pid2 = parseInt(m2[1], 10) - 1;
                if (pid2 >= 13 && pid2 <= 88) return pid2;
            }
        }
        return null;
    }

    function notify(problemId) {
        if (notified) return;
        notified = true;
        badge.textContent = '✓ 已通知';
        badge.style.background = '#2196f3';
        log('notify: problemId=' + problemId + ' opener=' + !!(window.opener && window.opener !== window));
        if (window.opener && window.opener !== window) {
            window.opener.postMessage({ type: 'acwing-accepted', problemId: problemId }, '*');
            log('postMessage sent');
        } else {
            log('ERROR: window.opener is null, cannot send postMessage');
        }
    }

    function scanForAccepted() {
        if (notified) return;
        var bodyText = (document.body.innerText || document.body.textContent || '');
        if (bodyText.indexOf('Accepted') !== -1 || bodyText.indexOf('答案正确') !== -1) {
            log('Detected Accepted in page text');
            var pid = getProblemId();
            if (pid) notify(pid);
            else log('Could not determine problem ID from URL: ' + location.href);
        }
    }

    log('Script v2.2 loaded. URL: ' + location.href + ' pid: ' + getProblemId() + ' opener: ' + !!(window.opener && window.opener !== window));

    // Scan on initial page load (for page-reload submissions)
    setTimeout(scanForAccepted, 2000);

    // Watch for dynamic DOM changes (for AJAX submissions)
    var timer = null;
    var observer = new MutationObserver(function() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(scanForAccepted, 1000);
    });

    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
})();
