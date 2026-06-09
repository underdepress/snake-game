// ==UserScript==
// @name         AcWing 剑指Offer 自动追踪
// @namespace    https://github.com/underdepress/acwing-tracker
// @version      2.1
// @description  AcWing提交通过后自动通知追踪页标记完成（postMessage，无需服务器）
// @author       underdepress
// @match        https://www.acwing.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var notified = false;

    function getProblemId() {
        var m = location.href.match(/\/problem\/content\/(\d+)/);
        if (!m) return null;
        var pid = parseInt(m[1], 10) - 1;
        return (pid >= 13 && pid <= 88) ? pid : null;
    }

    function notify(problemId) {
        if (notified) return;
        notified = true;
        if (window.opener && window.opener !== window) {
            window.opener.postMessage({ type: 'acwing-accepted', problemId: problemId }, '*');
        }
    }

    function scanForAccepted() {
        // Walk all text-containing leaf elements looking for the verdict
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            // Skip script/style/large containers
            if (el.children.length > 0 && el.tagName !== 'SPAN' && el.tagName !== 'TD' && el.tagName !== 'DIV') continue;
            var text = (el.textContent || '').trim();
            if (!text || text.length > 100) continue;
            if (text === 'Accepted' || text === 'Accept' ||
                text === '答案正确' || text.indexOf('答案正确') !== -1 ||
                text.indexOf('Accepted') !== -1 && text.length < 30) {
                var pid = getProblemId();
                if (pid) notify(pid);
                return;
            }
        }
    }

    // Scan on initial page load (for page-reload submissions)
    setTimeout(scanForAccepted, 1500);

    // Watch for dynamic DOM changes (for AJAX submissions)
    var timer = null;
    var observer = new MutationObserver(function() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(scanForAccepted, 800);
    });

    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
})();
