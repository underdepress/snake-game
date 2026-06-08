// ==UserScript==
// @name         AcWing 剑指Offer 自动追踪
// @namespace    https://github.com/underdepress/acwing-tracker
// @version      1.0
// @description  在AcWing提交题目通过后自动通知本地追踪器标记完成
// @author       underdepress
// @match        https://www.acwing.com/problem/content/*
// @match        https://www.acwing.com/problem/submission*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var SERVER = 'http://localhost:8765/mark-done';

    // Extract problem content_id from URL
    function getContentId(url) {
        var m = url.match(/\/problem\/content\/(\d+)/);
        if (m) return parseInt(m[1], 10);
        // Also try to find content_id from submission detail page
        m = url.match(/\/problem\/submission_detail\/(\d+)/);
        if (m) return null; // submission detail, need to find problem id differently
        return null;
    }

    // content_id → problem_id mapping for 剑指Offer
    function contentIdToProblemId(contentId) {
        var pid = contentId - 1;
        // 剑指Offer problems are 13-88, so content_ids 14-89
        if (pid >= 13 && pid <= 88) return pid;
        return null;
    }

    function markDone(problemId) {
        fetch(SERVER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ problemId: problemId })
        }).then(function(r) { return r.json(); })
          .then(function(data) {
              if (data.ok) {
                  console.log('[AcWingTracker] Marked problem ' + problemId + ' as done. Total: ' + data.total);
              }
          })
          .catch(function(err) {
              // Server not running or network error — silently ignore
          });
    }

    function checkAndMark(url) {
        var contentId = getContentId(url);
        if (!contentId) return;
        var problemId = contentIdToProblemId(contentId);
        if (!problemId) return;
        markDone(problemId);
    }

    // Strategy 1: Intercept XMLHttpRequest to catch submission responses
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._acwing_url = url;
        this._acwing_method = method;
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        var xhr = this;
        var url = xhr._acwing_url;
        var isSubmit = false;

        if (typeof url === 'string') {
            // AcWing submit endpoints
            if (url.indexOf('/problem/submit/') !== -1 ||
                url.indexOf('/problem/content/submit/') !== -1 ||
                url.indexOf('/submit') !== -1) {
                isSubmit = true;
            }
        }

        if (isSubmit) {
            xhr.addEventListener('readystatechange', function() {
                if (xhr.readyState === 4 && xhr.status === 200) {
                    try {
                        var resp = JSON.parse(xhr.responseText);
                        var status = (resp.status || resp.verdict || resp.result || '').toLowerCase();
                        var msg = (resp.message || resp.msg || '').toLowerCase();
                        // AcWing returns status like "AC", "Accepted", "答案正确"
                        var accepted =
                            status === 'ac' ||
                            status === 'accept' ||
                            status === 'accepted' ||
                            status.indexOf('accept') !== -1 ||
                            msg.indexOf('答案正确') !== -1 ||
                            msg.indexOf('通过') !== -1;
                        if (accepted) {
                            checkAndMark(window.location.href);
                        }
                    } catch(e) {}
                }
            });
        }

        return origSend.apply(this, arguments);
    };

    // Strategy 2: Intercept fetch
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input.url || '');
        var isSubmit = url.indexOf('/problem/submit/') !== -1 ||
                       url.indexOf('/problem/content/submit/') !== -1;

        return origFetch.apply(this, arguments).then(function(response) {
            if (isSubmit && response.ok) {
                // Clone to read the body without consuming it
                var cloned = response.clone();
                cloned.json().then(function(data) {
                    var status = (data.status || data.verdict || data.result || '').toLowerCase();
                    var msg = (data.message || data.msg || '').toLowerCase();
                    var accepted =
                        status === 'ac' ||
                        status === 'accept' ||
                        status === 'accepted' ||
                        status.indexOf('accept') !== -1 ||
                        msg.indexOf('答案正确') !== -1 ||
                        msg.indexOf('通过') !== -1;
                    if (accepted) {
                        checkAndMark(window.location.href);
                    }
                }).catch(function() {});
            }
            return response;
        });
    };

    // Strategy 3: DOM observer — watch for result panel appearing
    function observeResult() {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return;
                    // Look for result text elements
                    var text = (node.textContent || '').trim();
                    // Common AcWing result indicators
                    if (text === 'Accepted' ||
                        text === 'Accept' ||
                        text === '答案正确' ||
                        text.indexOf('答案正确') !== -1) {
                        checkAndMark(window.location.href);
                        return;
                    }
                    // Check child elements for result classes
                    var resultEls = node.querySelectorAll ? node.querySelectorAll('[class*="result"], [class*="status"], [class*="verdict"], .accepted, .accept') : [];
                    for (var i = 0; i < resultEls.length; i++) {
                        var t = (resultEls[i].textContent || '').trim();
                        if (t === 'Accepted' || t === 'Accept' || t === '答案正确' || t.indexOf('Accepted') !== -1) {
                            checkAndMark(window.location.href);
                            return;
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

    // Strategy 4: Periodically scan for "Accepted" text visible on page
    function scanForAccepted() {
        // Look for common AcWing success indicators
        var indicators = document.querySelectorAll('.accepted, .accept, [class*="accepted"], [class*="result"], .status-ac');
        for (var i = 0; i < indicators.length; i++) {
            var t = (indicators[i].textContent || '').trim().toLowerCase();
            if (t === 'accepted' || t === 'accept' || t === 'ac' || t === '答案正确' || t.indexOf('accept') !== -1) {
                checkAndMark(window.location.href);
                return;
            }
        }
    }

    // Start observation once DOM is ready
    function init() {
        observeResult();

        // Scan periodically for the first 30 seconds after page load
        // (covers the case where we missed the submission event)
        var scanCount = 0;
        var scanInterval = setInterval(function() {
            scanForAccepted();
            scanCount++;
            if (scanCount > 30) clearInterval(scanInterval); // stop after ~30s
        }, 1000);

        // Also check immediately
        setTimeout(function() { checkAndMark(window.location.href); }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
