// ==UserScript==
// @name         AcWing 剑指Offer 自动追踪
// @namespace    https://github.com/underdepress/acwing-tracker
// @version      2.0
// @description  AcWing提交通过后自动通知追踪页标记完成（postMessage，无需服务器）
// @author       underdepress
// @match        https://www.acwing.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function getProblemId() {
        var m = location.href.match(/\/problem\/content\/(\d+)/);
        if (!m) return null;
        var pid = parseInt(m[1], 10) - 1;
        return (pid >= 13 && pid <= 88) ? pid : null;
    }

    function notify(problemId) {
        if (window.opener && window.opener !== window) {
            window.opener.postMessage({ type: 'acwing-accepted', problemId: problemId }, '*');
        }
    }

    var observer = new MutationObserver(function(mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var nodes = mutations[i].addedNodes;
            for (var j = 0; j < nodes.length; j++) {
                var node = nodes[j];
                if (node.nodeType !== 1) continue;
                var text = (node.textContent || '').trim();
                if (text === 'Accepted' || text === '答案正确') {
                    var pid = getProblemId();
                    if (pid) notify(pid);
                    return;
                }
                // Also check child elements with result/status classes
                if (node.querySelectorAll) {
                    var results = node.querySelectorAll('[class*="result"], [class*="status"], [class*="verdict"]');
                    for (var k = 0; k < results.length; k++) {
                        var t = (results[k].textContent || '').trim();
                        if (t === 'Accepted' || t === '答案正确') {
                            var pid2 = getProblemId();
                            if (pid2) notify(pid2);
                            return;
                        }
                    }
                }
            }
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();
