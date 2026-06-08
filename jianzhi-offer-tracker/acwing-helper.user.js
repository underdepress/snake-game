// ==UserScript==
// @name         AcWing 剑指Offer 自动追踪
// @namespace    https://github.com/underdepress/acwing-tracker
// @version      1.2
// @description  在AcWing提交通过后自动通知追踪页标记完成
// @author       underdepress
// @match        https://www.acwing.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    var DEBUG = true; // set to false once working

    function log() {
        if (DEBUG) console.log('[AcWingTracker]', Array.prototype.slice.call(arguments).join(' '));
    }

    function getContentId(url) {
        var m = url.match(/\/problem\/content\/(\d+)/);
        if (m) return parseInt(m[1], 10);
        return null;
    }

    function contentIdToProblemId(contentId) {
        var pid = contentId - 1;
        if (pid >= 13 && pid <= 88) return pid;
        return null;
    }

    function notifyTracker(problemId) {
        log('notifyTracker: pid=' + problemId + ', hasOpener=' + !!(window.opener && window.opener !== window));

        if (window.opener && window.opener !== window) {
            try {
                window.opener.postMessage({
                    type: 'acwing-accepted',
                    problemId: problemId
                }, '*');
                log('postMessage sent successfully');
                return;
            } catch(e) {
                log('postMessage failed: ' + e.message);
            }
        }

        // Fallbacks: worker + local
        var urls = [
            'https://acwing-tracker.2392723979.workers.dev/mark-done',
            'http://localhost:8765/mark-done'
        ];
        urls.forEach(function(u) {
            fetch(u, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ problemId: problemId })
            }).then(function(r) { return r.json(); })
              .then(function(d) { if (d.ok) log('fallback ok: ' + u); })
              .catch(function() {});
        });
    }

    function checkAndMark(url) {
        var contentId = getContentId(url);
        log('checkAndMark: contentId=' + contentId);
        if (!contentId) return;
        var problemId = contentIdToProblemId(contentId);
        log('checkAndMark: problemId=' + problemId);
        if (!problemId) return;
        notifyTracker(problemId);
    }

    // --- Log ALL XHR requests to find the submit endpoint ---
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url) {
        this._aw_url = url;
        this._aw_method = method;
        return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(body) {
        var xhr = this;
        var url = (xhr._aw_url || '').toString();

        // Log every XHR that looks submission-related
        if (url.indexOf('submit') !== -1) {
            log('XHR submit detected: ' + xhr._aw_method + ' ' + url);
        }

        xhr.addEventListener('readystatechange', function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                if (url.indexOf('submit') !== -1) {
                    log('XHR submit response received, body preview:', xhr.responseText.substring(0, 300));
                }
                try {
                    var resp = JSON.parse(xhr.responseText);
                    // Try ALL possible status fields
                    var verdict = (resp.status || resp.verdict || resp.result ||
                                   resp.code || resp.msg || resp.message || '').toString();
                    var lowerV = verdict.toLowerCase();
                    log('XHR verdict check: "' + verdict + '" lower="' + lowerV + '"');

                    // Broad matching
                    if (lowerV === 'ac' || lowerV === 'accept' || lowerV === 'accepted' ||
                        lowerV.indexOf('accept') !== -1 ||
                        lowerV.indexOf('答案正确') !== -1 ||
                        lowerV.indexOf('通过') !== -1 ||
                        verdict.indexOf('答案正确') !== -1) {
                        log('>>> ACCEPTED detected via XHR!');
                        checkAndMark(window.location.href);
                    }
                } catch(e) {}
            }
        });

        return origSend.apply(this, arguments);
    };

    // --- Fetch interception with verbose logging ---
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input.url || '');

        if (url.indexOf('submit') !== -1) {
            log('Fetch submit detected: ' + url);
        }

        return origFetch.apply(this, arguments).then(function(response) {
            if (url.indexOf('submit') !== -1 && response.ok) {
                var cloned = response.clone();
                cloned.text().then(function(text) {
                    log('Fetch submit response: ' + text.substring(0, 300));
                    try {
                        var data = JSON.parse(text);
                        var verdict = (data.status || data.verdict || data.result ||
                                       data.code || data.msg || data.message || '').toString();
                        var lowerV = verdict.toLowerCase();
                        log('Fetch verdict check: "' + verdict + '"');

                        if (lowerV === 'ac' || lowerV === 'accept' || lowerV === 'accepted' ||
                            lowerV.indexOf('accept') !== -1 ||
                            lowerV.indexOf('答案正确') !== -1 ||
                            lowerV.indexOf('通过') !== -1 ||
                            verdict.indexOf('答案正确') !== -1) {
                            log('>>> ACCEPTED detected via fetch!');
                            checkAndMark(window.location.href);
                        }
                    } catch(e) {
                        log('Fetch response parse error: ' + e.message);
                    }
                }).catch(function() {});
            }
            return response;
        });
    };

    // --- DOM observer ---
    function observeResult() {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return;
                    var text = (node.textContent || '');
                    // Log text that looks like a verdict
                    var trimText = text.trim();
                    if (trimText && trimText.length < 50 &&
                        (trimText.indexOf('Accept') !== -1 ||
                         trimText.indexOf('正确') !== -1 ||
                         trimText.indexOf('错误') !== -1 ||
                         trimText.indexOf('通过') !== -1 ||
                         trimText.indexOf('Wrong') !== -1)) {
                        log('DOM text observed: "' + trimText + '"');
                    }
                    if (trimText === 'Accepted' || trimText === 'Accept' ||
                        trimText === '答案正确' || trimText.indexOf('答案正确') !== -1) {
                        log('>>> ACCEPTED detected via DOM!');
                        checkAndMark(window.location.href);
                    }
                    if (node.querySelectorAll) {
                        var els = node.querySelectorAll('[class*="result"], [class*="status"], [class*="verdict"]');
                        for (var i = 0; i < els.length; i++) {
                            var t = (els[i].textContent || '').trim();
                            if (t === 'Accepted' || t === 'Accept' || t === '答案正确') {
                                log('>>> ACCEPTED detected via DOM element!');
                                checkAndMark(window.location.href);
                                return;
                            }
                        }
                    }
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    }

    function scanForAccepted() {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if ((t === 'Accepted' || t === 'Accept' || t === '答案正确') && all[i].children.length === 0) {
                log('>>> ACCEPTED detected via scan!');
                checkAndMark(window.location.href);
                return;
            }
        }
    }

    function init() {
        log('Script v1.2 active. URL: ' + window.location.href);
        log('Content ID: ' + getContentId(window.location.href));
        log('Problem ID: ' + contentIdToProblemId(getContentId(window.location.href) || 0));
        log('Has opener: ' + !!(window.opener && window.opener !== window));

        observeResult();
        var count = 0;
        var interval = setInterval(function() {
            scanForAccepted();
            if (++count > 60) clearInterval(interval); // 60s scan window
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
