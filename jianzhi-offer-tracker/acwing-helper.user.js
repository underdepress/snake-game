// ==UserScript==
// @name         AcWing 剑指Offer 自动追踪
// @namespace    https://github.com/underdepress/acwing-tracker
// @version      1.1
// @description  在AcWing提交通过后自动通知追踪页标记完成（通过postMessage，无需服务器）
// @author       underdepress
// @match        https://www.acwing.com/problem/content/*
// @match        https://www.acwing.com/problem/submission*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Extract problem content_id from URL
    function getContentId(url) {
        var m = url.match(/\/problem\/content\/(\d+)/);
        if (m) return parseInt(m[1], 10);
        return null;
    }

    // content_id -> problem_id mapping for 剑指Offer (only problems 13-88)
    function contentIdToProblemId(contentId) {
        var pid = contentId - 1;
        if (pid >= 13 && pid <= 88) return pid;
        return null;
    }

    function notifyTracker(problemId) {
        // Primary: postMessage to the tracker page that opened this tab
        if (window.opener && window.opener !== window) {
            try {
                window.opener.postMessage({
                    type: 'acwing-accepted',
                    problemId: problemId
                }, '*');
                console.log('[AcWingTracker] Sent to tracker via postMessage: problem ' + problemId);
                return;
            } catch(e) {}
        }

        // Fallback 1: Cloudflare Worker
        var WORKER = 'https://acwing-tracker.2392723979.workers.dev/mark-done';
        fetch(WORKER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ problemId: problemId })
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              if (data.ok) console.log('[AcWingTracker] Marked via worker: problem ' + problemId);
          })
          .catch(function() {
              // Fallback 2: local server
              fetch('http://localhost:8765/mark-done', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ problemId: problemId })
              }).then(function(r) { return r.json(); })
                .then(function(data) {
                    if (data.ok) console.log('[AcWingTracker] Marked via local server: problem ' + problemId);
                })
                .catch(function() {});
          });
    }

    function checkAndMark(url) {
        var contentId = getContentId(url);
        if (!contentId) return;
        var problemId = contentIdToProblemId(contentId);
        if (!problemId) return;
        notifyTracker(problemId);
    }

    // --- Detection: XHR interception ---
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._acwing_url = url;
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        var xhr = this;
        var url = xhr._acwing_url || '';
        var isSubmit = url.indexOf('/problem/submit/') !== -1 ||
                       url.indexOf('/submit') !== -1;

        if (isSubmit) {
            xhr.addEventListener('readystatechange', function() {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        var status = (resp.status || resp.verdict || resp.result || '').toLowerCase();
                        var msg = (resp.message || resp.msg || '').toLowerCase();
                        if (status === 'ac' || status === 'accept' || status === 'accepted' ||
                            status.indexOf('accept') !== -1 ||
                            msg.indexOf('答案正确') !== -1 ||
                            msg.indexOf('通过') !== -1) {
                            checkAndMark(window.location.href);
                        }
                    } catch(e) {}
                }
            });
        }
        return origSend.apply(this, arguments);
    };

    // --- Detection: fetch interception ---
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input.url || '');
        var isSubmit = url.indexOf('/problem/submit/') !== -1;

        return origFetch.apply(this, arguments).then(function(response) {
            if (isSubmit && response.ok) {
                var cloned = response.clone();
                cloned.json().then(function(data) {
                    var status = (data.status || data.verdict || data.result || '').toLowerCase();
                    var msg = (data.message || data.msg || '').toLowerCase();
                    if (status === 'ac' || status === 'accept' || status === 'accepted' ||
                        status.indexOf('accept') !== -1 ||
                        msg.indexOf('答案正确') !== -1 ||
                        msg.indexOf('通过') !== -1) {
                        checkAndMark(window.location.href);
                    }
                }).catch(function() {});
            }
            return response;
        });
    };

    // --- Detection: DOM observer ---
    function observeResult() {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return;
                    var text = (node.textContent || '').trim();
                    if (text === 'Accepted' || text === 'Accept' ||
                        text === '答案正确' || text.indexOf('答案正确') !== -1 ||
                        text.indexOf('Accepted') !== -1) {
                        checkAndMark(window.location.href);
                        return;
                    }
                    if (node.querySelectorAll) {
                        var resultEls = node.querySelectorAll('[class*="result"], [class*="status"], [class*="verdict"]');
                        for (var i = 0; i < resultEls.length; i++) {
                            var t = (resultEls[i].textContent || '').trim();
                            if (t === 'Accepted' || t === 'Accept' ||
                                t === '答案正确' || t.indexOf('Accepted') !== -1) {
                                checkAndMark(window.location.href);
                                return;
                            }
                        }
                    }
                });
            });
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function scanForAccepted() {
        var indicators = document.querySelectorAll('.accepted, .accept, [class*="accepted"], [class*="result"], .status-ac');
        for (var i = 0; i < indicators.length; i++) {
            var t = (indicators[i].textContent || '').trim().toLowerCase();
            if (t === 'accepted' || t === 'accept' || t === 'ac' || t === '答案正确') {
                checkAndMark(window.location.href);
                return;
            }
        }
    }

    function init() {
        observeResult();
        var count = 0;
        var interval = setInterval(function() {
            scanForAccepted();
            if (++count > 30) clearInterval(interval);
        }, 1000);
        setTimeout(function() { checkAndMark(window.location.href); }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
