// ==UserScript==
// @name         Review Queue Helper
// @description  Keyboard shortcuts, skips accepted questions and audits (to save review quota)
// @homepage     https://github.com/samliew/SO-mod-userscripts
// @author       @samliew
// @version      1.3.1
//
// @include      https://*stackoverflow.com/review*
// @include      https://*serverfault.com/review*
// @include      https://*superuser.com/review*
// @include      https://*askubuntu.com/review*
// @include      https://*mathoverflow.net/review*
// @include      https://*.stackexchange.com/review*
//
// @exclude      *chat.*
// @exclude      *meta.*
// @exclude      https://stackoverflow.com/c/*
// @exclude      https://stackoverflow.blog*
//
// @grant        GM_addStyle
// ==/UserScript==


// Detect if SOMU is loaded
const rafAsync = () => new Promise(resolve => { requestAnimationFrame(resolve); });
async function waitForSOMU() {
    while(typeof SOMU === 'undefined' || !SOMU.hasInit) { await rafAsync(); }
    return SOMU;
}


(function() {
    'use strict';


    const scriptName = GM_info.script.name;
    const queueType = location.href.replace(/\/\d+/, '').split('/').pop();
    const filteredElem = document.querySelector('.review-filter-tags');
    const filteredTags = filteredElem ? (filteredElem.value || '').split(' ') : [''];
    let processReview, post = {}, skipAccepted = false;


    function loadOptions() {
        waitForSOMU().then(function(SOMU) {

            // Set option field in sidebar with current custom value; use default value if not set before
            SOMU.addOption(scriptName, 'Skip Accepted Questions', skipAccepted, 'bool');

            // Get current custom value with default
            skipAccepted = SOMU.getOptionValue(scriptName, 'Skip Accepted Questions', skipAccepted, 'bool');
        });
    }


    function skipReview() {
        setTimeout(function() {
            $('.review-actions').find('input[value$="Skip"], input[value$="Next"]').click();
        }, 500);
    }


    function isAudit() {

        let audit = false;

        // Post does not have any of the filtered tags
        if(post.tags && post.tags.length && filteredTags[0] !== '' && !filteredTags.some(t => post.tags.includes(t))) {
            audit = true;
        }

        // Check post score
        else if(!isNaN(post.votes)) {

            let votes, error = false;
            $.ajax({
                url: `https://${location.hostname}/posts/${post.id}/vote-counts`,
                async: false
            }).done(function(data) {
                votes = Number(data.up) + Number(data.down);
            }).fail(function() {
                console.error('failed fetching vote counts');
                error = true;
            });

            // Displayed post score not same as fetched vote score
            if(!error && votes !== post.votes) audit = true;
        }

        console.log("audit:", audit);
        return audit;
    }


    function processCloseReview() {

        // Accepted, skip if enabled
        if(skipAccepted && post.accepted) {
            console.log("skipping accepted question");
            skipReview();
            return;
        }
    }


    function doPageLoad() {

        // Detect queue type and set appropriate process function
        switch(queueType) {
            case 'close':
                processReview = processCloseReview; break;
            case 'reopen':
                processReview = processCloseReview; break;
            case 'suggested-edits':
                processReview = processCloseReview; break;
            case 'helper':
                processReview = processCloseReview; break;
            case 'low-quality-posts':
                processReview = processCloseReview; break;
            case 'triage':
                processReview = processCloseReview; break;
            case 'first-posts':
                processReview = processCloseReview; break;
            case 'late-answers':
                processReview = processCloseReview; break;
        }

        // Focus VTC button when radio button in close dialog popup is selected
        $(document).on('click', '#popup-close-question input:radio', function() {
            // Not migrate anywhere radio
            if(this.id === 'migrate-anywhere') return;

            $('#popup-close-question').find('input:submit').focus();
        });

        // Focus Delete button when radio button in delete dialog popup is selected
        $(document).on('click', '#delete-question-popup input:radio', function() {
            $('#delete-question-popup').find('input:submit').focus();
        });

        // Focus Flag button when radio button in flag dialog popup is selected
        $(document).on('click', '#popup-flag-post input:radio', function() {
            $('#popup-flag-post').find('input:submit').focus();
        });

        // Focus Reject button when radio button in edit reject dialog popup is selected
        $(document).on('click', '#rejection-popup input:radio', function() {
            $('#rejection-popup').find('input:submit').focus();
        });

        // Cancel existing handlers and implement our own keyboard shortcuts
        $(document).off('keypress keyup');

        // Keyboard shortcuts event handler
        $(document).on('keyup', function(evt) {
            const goback = evt.keyCode === 27 || evt.keyCode === 192; // escape button (27) or tilde (192)
            let index = evt.keyCode - 49; // 49 = number 1 = 0 (index)
            if(index < 0 || index > 6) index = null; // handle 1-7 number keys only (index 0-6)
            //console.log("keypress", evt.keyCode, "index", index);

            // Do nothing if post is being edited
            if($('.editing-review-content').length > 0) return;

            // Is close menu open?
            const closeMenu = $('#popup-close-question:visible');
            if(closeMenu.length > 0) {

                // If escape key pressed, go back to previous pane, or dismiss popup if on main pane
                if(goback) {
                    // Get link in breadcrumbs
                    const link = closeMenu.find('.popup-breadcrumbs a').last();
                    // Go back to previous pane if possible
                    if(link.length) {
                        link.click();
                    }
                    // Dismiss popup if on main pane
                    else {
                        closeMenu.find('.popup-close a').click();
                    }
                    return false;
                }

                // If valid index, click it
                else if(index != null) {
                    // Get active (visible) pane
                    const pane = closeMenu.find('.popup-active-pane');
                    // Get options
                    const opts = pane.find('input:radio');
                    // Click option
                    const opt = opts.eq(index).click();
                    // Job is done here. Do not bubble if an option was clicked
                    return opt.length !== 1;
                }

                return;
            }

            // Is delete menu open?
            const deleteMenu = $('#delete-question-popup:visible');
            if(deleteMenu.length > 0) {

                // Dismiss popup on escape key
                if(goback) {
                    deleteMenu.find('.popup-close a').click();
                    return false;
                }

                // If valid index, click it
                else if(index != null) {
                    // Get active (visible) pane
                    const pane = deleteMenu.find('.popup-active-pane');
                    // Get options
                    const opts = pane.find('input:radio');
                    // Click option
                    const opt = opts.eq(index).click();
                    // Job is done here. Do not bubble if an option was clicked
                    return opt.length !== 1;
                }

                return;
            }

            // Is flag menu open?
            const flagMenu = $('#popup-flag-post:visible');
            if(flagMenu.length > 0) {

                // Dismiss popup on escape key
                if(goback) {
                    flagMenu.find('.popup-close a').click();
                    return false;
                }

                // If custom mod flag box is focused, do nothing
                else if($('.mod-attention-subform textarea:focus').length == 1) {
                    return false;
                }

                // If valid index, click it
                else if(index != null) {
                    // Get options
                    const opts = flagMenu.find('input:radio');
                    // Click option
                    const opt = opts.eq(index).click();
                    // Job is done here. Do not bubble if an option was clicked
                    return opt.length !== 1;
                }

                return;
            }

            // Is reject menu open?
            const rejectMenu = $('#rejection-popup:visible');
            if(rejectMenu.length > 0) {

                // Dismiss popup on escape key
                if(goback) {
                    rejectMenu.find('.popup-close a').click();
                    return false;
                }

                // If custom mod flag box is focused, do nothing
                else if($('textarea.custom-reason-text:focus').length == 1) {
                    return false;
                }

                // If valid index, click it
                else if(index != null) {
                    // Get options
                    const opts = rejectMenu.find('input:radio');
                    // Click option
                    const opt = opts.eq(index).click();
                    // Job is done here. Do not bubble if an option was clicked
                    return opt.length !== 1;
                }

                return;
            }

            // If escape key pressed and close popup dialog not open, do nothing
            if(goback) {
                return;
            }

            if(index != null) {
                const btns = $('.review-actions input');

                // If there is only one button and is "Next", click it
                if(btns.length === 1) {
                    index = 0;
                }

                // Default to clicking review buttons based on index
                btns.eq(index).click();

                return false;
            }
        });
    }


    function listenToPageUpdates() {

        // On any page update
        $(document).ajaxComplete(function(event, xhr, settings) {

            // Do nothing with fetching vote counts
            if(settings.url.includes('/vote-counts')) return;

            // Do nothing with saving preferences
            if(settings.url.includes('/users/save-preference')) return;

            // Close dialog loaded
            if(settings.url.includes('/close/popup')) {
                setTimeout(function() {

                    // Select default radio based on previous votes
                    let opts = $('#popup-close-question .bounty-indicator-tab').slice(0, -1).get().sort((a, b) => Number(a.innerText) - Number(b.innerText));
                    const selOpt = $(opts).last().closest('label').find('input').click();
                    console.log(selOpt);

                    // If selected option is in a subpane, display off-topic subpane instead
                    const pane = selOpt.closest('.popup-subpane');
                    if(pane.attr('id') !== 'pane-main') {

                        // Get pane name
                        const paneName = pane.attr('data-subpane-name');

                        // Select radio with same subpane name
                        $(`#popup-close-question input[data-subpane-name="${paneName}"]`).click();

                        // Re-select option
                        selOpt.click();
                    }
                }, 50);
            }

            // Delete dialog loaded
            else if(settings.url.includes('/posts/popup/delete/')) {
                setTimeout(function() {
                    // Focus Delete button
                    $('#delete-question-popup').find('input:submit').focus();
                }, 50);
            }

            // Flag dialog loaded
            else if(settings.url.includes('/flags/posts/') && settings.url.includes('/popup')) {
                // Do nothing by default
            }

            // Question was closed
            else if(settings.url.includes('/close/add')) {
                $('.review-actions input[value*="Close"]').attr('disabled', true);
            }

            // Next review loaded, transform UI and pre-process review
            else if(settings.url.includes('/review/next-task') || settings.url.includes('/review/task-reviewed/')) {

                // Get additional info about review from JSON response
                let responseJson = {};
                try {
                    responseJson = JSON.parse(xhr.responseText);
                    console.log(responseJson);
                }
                catch (e) {
                    console.error('error parsing JSON', xhr.responseText);
                }

                // If action was taken (post was refreshed), don't do anything else
                if(responseJson.isRefreshing) return;

                setTimeout(function() {

                    // Get post type
                    const isQuestion = $('.reviewable-post .answers-subheader').length == 1;

                    // Get post status
                    const isClosedOrDeleted = $('.reviewable-post').first().find('.question-status, .deleted-answer').length > 0;
                    console.log('isClosedOrDeleted', isClosedOrDeleted);

                    // If no more reviews, refresh page every 10 seconds
                    // Can't use responseJson.isUnavailable here, as it can also refer to current completed review
                    if($('.review-instructions').text().includes('This queue has been cleared!')) {
                        setTimeout(() => location.reload(true), 10000);
                        return;
                    }

                    // If first-posts or late-answers queue, and not already reviewed (no Next button)
                    const reviewStatus = $('.review-status').text();
                    if((location.pathname.includes('/review/first-posts/') || location.pathname.includes('/review/late-answers/'))
                       && !reviewStatus.includes('This item is no longer reviewable.') && !reviewStatus.includes('Review completed')) {

                        // If question, insert "Close" option
                        if(isQuestion) {
                            const closeBtn = $(`<input type="button" value="Close" title="close question" />`).attr('disabled', isClosedOrDeleted);
                            closeBtn.click(function() {
                                // If button not disabled
                                if(!$(this).prop('disabled')) {
                                    $(this).prop('disabled', true);
                                    $('.close-question-link').click();
                                }
                                return false;
                            });
                            $('.review-actions input').first().after(closeBtn);
                        }

                        // Else if answer, insert "Delete" option
                        else {
                            const delBtn = $(`<input type="button" value="Delete" title="delete answer" />`).attr('disabled', isClosedOrDeleted);
                            delBtn.click(function() {
                                // If button not disabled
                                if(!$(this).prop('disabled')) {
                                    $(this).prop('disabled', true);
                                    $('.post-menu').first().find('a[title*="delete"]').click();
                                }
                                return false;
                            });
                            $('.review-actions input').first().after(delBtn);
                        }
                    }

                    // Remove "Delete" option for suggested-edits queue, if not already reviewed (no Next button)
                    if(location.pathname.includes('/review/suggested-edits/') && !$('.review-status').text().includes('This item is no longer reviewable.')) {
                        $('.review-actions input[value*="Delete"]').remove();
                    }

                    // Modify buttons
                    $('.review-actions input').val(function(i, v) {
                        return '[' + (i+1) + '] ' + v;
                    });

                    // Get review vars
                    post = {
                        id: responseJson.postId,
                        title: $('h1[itemprop="name"] a').text(),
                        content: $('.post-text').first().text(),
                        votes: parseInt($('.js-vote-count').first().text(), 10),
                        tags: $('.post-taglist .post-tag').get().map(v => v.innerText),
                        isQuestion: isQuestion,
                        isClosedOrDeleted: isClosedOrDeleted,
                    };
                    // Parse post stats from sidebar
                    $('.reviewable-post:first .reviewable-post-stats tr').each(function() {
                        const k = $(this).find('.label-key').text();
                        let v = $(this).find('.label-value').text();

                        if(k.length == 0 && v.length == 0) return;

                        // try convert to primitive
                        let d = new Date($(this).find('.label-value').attr('title')).getTime();
                        let b = v == 'no' ? false : v == 'yes' ? true : null;
                        let n = parseInt(v, 10);

                        if(!isNaN(d)) v = d; // date
                        else if(b !== null) v = b; // bool
                        else if(!isNaN(n)) v = n; // number

                        post[k] = v;
                    });
                    console.log(post);

                    // Check for audits and skip them
                    if(responseJson.isAudit) {
                        console.log('skipping review audit');
                        skipReview();
                        return;
                    }
                    else if(isAudit()) {
                        console.log('skipping review audit via manual check');
                        skipReview();
                        return;
                    }

                    // Process post based on queue type
                    processReview();

                }, 50);
            }
        });
    }


    GM_addStyle(`
#footer {
    display: none !important;
}
pre {
    max-height: 320px;
}

/* Number options in popups */
.popup .action-list li:before {
    position: absolute;
    top: 9px;
    left: -18px;
    font-weight: bold;
    color: #333;
}
.popup .action-list li:nth-child(1):before {
    content: '[1]';
}
.popup .action-list li:nth-child(2):before {
    content: '[2]';
}
.popup .action-list li:nth-child(3):before {
    content: '[3]';
}
.popup .action-list li:nth-child(4):before {
    content: '[4]';
}
.popup .action-list li:nth-child(5):before {
    content: '[5]';
}
.popup .action-list li:nth-child(6):before {
    content: '[6]';
}
.popup .action-list li:nth-child(7):before {
    content: '[7]';
}
`);


    // On page load
    loadOptions();
    doPageLoad();
    listenToPageUpdates();


})();