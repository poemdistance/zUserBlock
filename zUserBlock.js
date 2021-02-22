// ==UserScript==
// @name             zUserBlocker
// @description      拉黑用户插件,免打开用户详情页.
// @require          http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// @match            https://*.zhihu.com/*
// @grant            GM_addStyle
// @grant            GM_xmlhttpRequest
// ==/UserScript==

var $ = window.jQuery;

const BOTTOM_TYPE = 0;
const TITLE_TYPE = 1;
var bottom_cache = []

//waitForKeyElements(".Button", removeUnnessisaryButton);
//waitForKeyElements('[class="Popover ShareMenu ContentItem-action"]', function(node){node.remove()});

waitForKeyElements(".ContentItem-actions", addAnswerBlockButton);
waitForKeyElements("[itemprop='zhihu:question'], .ContentItem-title", addQuestionerBlockButton);
waitForKeyElements( ".CommentItemV2-footer", addCommentAuthorBlockButton );


function waitForKeyElements (
selectorTxt,/* Required: The jQuery selector string that
            specifies the desired element(s).
            */
 actionFunction,/* Required: The code to run when elements are
            found. It is passed a jNode to the matched
            element.
            */
 bWaitOnce,/* Optional: If false, will continue to scan for
            new elements even after the first match is
            found.
            */
 iframeSelector/* Optional: If set, identifies the iframe to
            search.
            */
) {
    var targetNodes, btargetsFound;

    if (typeof iframeSelector == "undefined") {
        targetNodes = $(selectorTxt);
    }
    else {
        targetNodes = $(iframeSelector).contents ()
            .find (selectorTxt);
    }

    if (targetNodes && targetNodes.length > 0) {
        btargetsFound = true;
        /*--- Found target node(s). Go through each and act if they
      are new.
      */
        targetNodes.each ( function () {
            var jThis = $(this);
            var alreadyFound = jThis.data ('alreadyFound') || false;

            if (!alreadyFound) {
                //--- Call the payload function.
                var cancelFound = actionFunction (jThis);
                if (cancelFound) {
                    btargetsFound = false;
                }
                else {
                    jThis.data ('alreadyFound', true);
                }
            }
        } );
    }
    else {
        btargetsFound = false;
    }

    //--- Get the timer-control variable for this selector.
    var controlObj = waitForKeyElements.controlObj || {};
    var controlKey = selectorTxt.replace (/[^\w]/g, "_");
    var timeControl = controlObj [controlKey];

    //--- Now set or clear the timer as appropriate.
    if (btargetsFound && bWaitOnce && timeControl) {
        //--- The only condition where we need to clear the timer.
        clearInterval (timeControl);
        delete controlObj [controlKey]
    }
    else {
        //--- Set a timer, if needed.
        if ( ! timeControl) {
            timeControl = setInterval ( function () {
                waitForKeyElements ( selectorTxt,
                                    actionFunction,
                                    bWaitOnce,
                                    iframeSelector
                                   );
            },
                                       50
                                      );
            controlObj [controlKey] = timeControl;
        }
    }
    waitForKeyElements.controlObj = controlObj;
}


function no_need_to_add_button( cache, target, type ) {

    if ( type == TITLE_TYPE ) {

        var next_node = target[0].children;
        //console.log(next_node);

        // 视频标题不会重复添加拉黑按钮, 直接返回
        var href = next_node.href;
        if ( href && href.substr('zvideo') ) return false;

        //console.log(next_node[0].attribures);
        var itemprop = next_node[0].attributes[0].nodeValue;

        if ( itemprop == 'zhihu:question' ) {
            return true;
        }
        else {
            return false;
        }
    }

    // 检查是否添加过Block按钮,防止重复添加
    for ( var item of cache ) {
        var history = simpleStringify( item[0] );
        var parent = simpleStringify( target[0].parentNode );
        try {

            if ( type == BOTTOM_TYPE && history == parent ) {
                return true;
            }
            else {
                continue;
            }
        }
        catch( Exception ) {
            console.log('Exception : ' + Exception );
            continue;
        }
    }
    return false;
}


function simpleStringify (object){
    var simpleObject = {};
    for (var prop in object ){
        if (!object.hasOwnProperty(prop)){
            continue;
        }
        if (typeof(object[prop]) == 'object'){
            continue;
        }
        if (typeof(object[prop]) == 'function'){
            continue;
        }
        simpleObject[prop] = object[prop];
    }
    return JSON.stringify(simpleObject); // returns cleaned up JSON
};


function get_user_name( user_url ) {
    var index = user_url.lastIndexOf('/');
    var user_name = user_url.substr(index+1);
    console.log('Parse user_name: ' + user_name );
    return user_name;
}

function select_block_action( user_name, button ) {
    var status_url_prefix = 'https://www.zhihu.com/api/v4/members/'
    var status_url_suffix = '?include=allow_message,is_followed,is_following,is_org,is_blocking,employments,answer_count,follower_count,articles_count,gender,badge[?(type=best_answerer)].topics';;
    var status_url = status_url_prefix + user_name + status_url_suffix;
    $.ajax({
        type: 'GET',
        url: status_url,
        button: button,
        dataType: 'html',
        beforeSend: function(xhr){},
        success: function(response) {
            var response_json = JSON.parse( response );
            console.log('Get user status, is_blocking: ' + response_json.is_blocking );
            console.log(response);
            console.log('check button value in select block action: ');
            console.log(this.button);
            block_user( user_name, this.button, response_json.is_blocking );
        }
    })
}

function block_user( user_name, button, is_blocking ) {
    var block_url = 'https://www.zhihu.com/api/v4/members/' + user_name + '/actions/block';

    var next_action = button.value;
    if ( is_blocking && next_action == 'block' ) {
        console.log('Already blocking');
        button.innerHTML = '&nbsp[撤销]';
        button.value = 'unblock';
        return;
    }
    else if ( !is_blocking && next_action == 'unblock' ) {
        console.log('Already unblock');
        button.innerHTML = '&nbsp[拉黑]';
        button.value = 'block';
        return;
    }

    var block_action = '';
    if ( is_blocking ) {
        block_action = 'DELETE';
    }
    else {
        block_action = 'POST';
    }

    $.ajax({
        url: block_url,
        button: button,
        type: block_action,
        beforeSend: function(xhr) {},
        success: function(response) {
            console.log('check button value in block user: ');
            console.log(this.button);
            console.log('Block ' + user_name + ' Successful.');
            if ( this.type == 'POST' ) {
                this.button.innerHTML = '&nbsp[撤销]';
                this.button.value = 'unblock';
            }
            else {
                this.button.innerHTML = '&nbsp[拉黑]';
                this.button.value = 'block';
            }
        }
    })
}

function processBlockPerson( data, button ) {
    var response = $(data);
    console.log('Try to get user link, the response is: ');
    console.log(response);
    var user_url = '';
    var node = $('a.UserLink-link', response);
    if ( node.length <= 0 ) {
        console.error("Didn't find the target user_url. ");
        return;
    }

    for ( var item in node ) {
        user_url = node[0].href;
        break;
    }
    console.log('Get user url: ' + user_url );

    var user_name = get_user_name( user_url );

    console.log('check button value in processBlockPerson');
    console.log(button);
    select_block_action( user_name, button );
}

function zhuanlanAuthorBlock( target_url, button ) {
    GM_xmlhttpRequest({
        method: "GET",
        url: target_url,
        type: 'text/html',
        onload: function(response) {
            console.log('check button value in xmlhttp request: ');
            console.log(button);
            processBlockPerson(response.responseText, button);
        }
    });
}

function answerOrVideoAuthorBlock( target_url, button ) {
    // 异步请求获取回答/视频页面html
    $.ajax({
        type: 'GET',
        url: target_url,
        button: button,
        crossDomain: true,
        dataType:"html",
        beforeSend: function(xhr) {},
        success: function(response) {
            console.log('check button value in not post type branch: ');
            console.log(this.button);
            processBlockPerson(response, this.button);
        }
    })
}

function addAnswerBlockButton( node ) {

    console.log('-----------------------Answer Block Button Added-----------------------------')

    var button = document.createElement("button");
    button.innerHTML = "&nbsp[拉黑]";
    button.className = "Button Menu-item AnswerItem-self text-left Button--plain";
    button.type = "button"
    button.id = "block_button";
    button.value = "block";

    if ( no_need_to_add_button( bottom_cache, node, BOTTOM_TYPE ) ) return;
    bottom_cache.push( node );

    node[0].appendChild( button );

    //--- Activate the newly added button.
    button.addEventListener (
        "click", function(){processBlockAction(node[0], button)}, false
    );

    function processBlockAction (node, button) {

        var post_url = 'https://www.zhihu.com/api/v4/members/';
        var member = '';
        var action = '/actions/block';

        var parent_id = node.parentNode.id;

        var separator = '-';
        var index = parent_id.indexOf(separator);
        var alias_id = parent_id.substr(0,index).concat("-").concat("toggle");

        // 根据点击位置的元素, 最终真实数据所在节点对象
        var real_content;
        var name = '';
        var token = '';
        var parent_token = '';
        var content_type = '';
        var current_class = '';
        var parent_node = node.parentNode;
        var current_node = node;

        var maybe_use_obj = [];

        // 找到class为Feed或者ContentItem AnswerItem的div节点
        while ( true ) {

            console.log( 'Process parent node: ' + parent_node );
            current_class = parent_node.getAttribute('class');
            current_node = parent_node;

            console.log( 'Current obj class name is : ' + current_class )
            if ( current_class == null && maybe_use_obj.length > 0 || current_class == 'TopstoryQuestionAskItem') {
                current_node = maybe_use_obj[0];
                break;
            }

            if ( current_class == 'ContentItem AnswerItem' ) {
                maybe_use_obj.push( current_node);
            }
            if ( current_class == 'Feed' ) break;

            parent_node = parent_node.parentNode;
        }

        console.log('Get json data from current node: ');
        console.log(current_node);
        var json_str = current_node.getAttribute('data-za-extra-module');
        var json_obj = JSON.parse( json_str );

        token = json_obj.card.content.token;
        parent_token = json_obj.card.content.parent_token;
        content_type = json_obj.card.content.type;

        var answer_url = '';
        var video_url = '';
        var zhuanlan_url = ''; // 专栏url, 不要问我为什么用拼音, 去问知乎...
        var target_url = '';
        var target_type = 0;

        const ANSWER_TYPE = 1;
        const VIDEO_TYPE = 2;
        const POST_TYPE = 3;

        var is_token_valid = token && token.length > 0;
        if ( is_token_valid && content_type == 'Answer' ) {
            if ( !parent_token || parent_token.length <= 0 ) {
                parent_token = JSON.parse(maybe_use_obj[0].getAttribute('data-za-extra-module')).card.content.parent_token;
            }

            answer_url = 'https://www.zhihu.com/question/' + parent_token + '/answer/' + token;
            target_url = answer_url;
            target_type = ANSWER_TYPE;
        }
        else if ( is_token_valid && content_type == 'Zvideo' ) {
            video_url = 'https://www.zhihu.com/zvideo/' + token;
            target_url = video_url;
            target_type = VIDEO_TYPE;
            console.log(' Video url: ' + video_url );
        }
        else if ( is_token_valid && content_type == 'Post' ) {
            zhuanlan_url = 'https://zhuanlan.zhihu.com/p/' + token;
            target_url = zhuanlan_url;
            target_type = POST_TYPE;
            console.log( '专栏 url: ' + zhuanlan_url );
        }
        else {
            console.log("不支持该类型的拉黑操作/获取token失败, token: "+token + ' parent_token: ' + parent_token);
        }

        console.log('Target link is: ' + target_url );

        console.log('check button value in outside: ');
        console.log(button);

        if ( target_type != POST_TYPE ) {
            answerOrVideoAuthorBlock( target_url, button );
        } else {
            zhuanlanAuthorBlock( target_url, button );
        }

    }
}


function addQuestionerBlockButton( node ) {

    console.log('----------------------Questioner Block Button Added-------------------------');

    var button = document.createElement("button");
    button.innerHTML = "&nbsp[拉黑] ";
    button.className = "Button Button--plain";
    button.type = "button"
    button.id = "questioner_block";
    button.value = "block";

    if ( no_need_to_add_button( null, node, TITLE_TYPE ) ) return;
    node[0].appendChild( button );

    button.addEventListener (
        "click", function(){processBlockQuestioner(node, button)}, false
    );
}

const VIDEO_TYPE = 0;
const QUESTION_TYPE = 1;
const ARTICLE_TYPE = 2;

function processBlockQuestioner( node, button) {

    console.log('---------------processBlockQuestioner-----------------------');
    var data = get_url_from_sibling_element( node );
    var target_url = data[0];
    var target_type = data[1];

    console.log('target url is : ' + target_url );
    console.log('target type is : ' + target_type );

    if ( target_type == VIDEO_TYPE ) {
        answerOrVideoAuthorBlock( target_url, button );
    }
    else if ( target_type == ARTICLE_TYPE ) {
        zhuanlanAuthorBlock( target_url, button );
    }
    else if ( target_type == QUESTION_TYPE ) {
        process_questioner_block( target_url, button );
    }
}

function process_questioner_block( target_url, button ) {
    $.ajax({
        type: 'GET',
        url: target_url,
        button: button,
        dataType:"html",
        beforeSend: function(xhr) {},
        success: function(response) {
            var questioner_name = get_question_name( response, this.button );
            select_block_action( questioner_name, this.button );
        }
    })
}

function get_question_name( response, button ) {

    var page = $(response);
    var target_div = $("#zh-question-log-list-wrap", page);

    var timeline = target_div[0].children;
    var len = timeline.length;

    console.log( len );
    console.log( timeline[len-1] );

    var questioner_url = '';
    var questioner_name = '';
    var all_questioner_data = timeline[len-1];

    for ( var item of all_questioner_data.children ) {
        try {
            questioner_url = item.children[0].href;
            console.log( questioner_url );

            if ( questioner_url.indexOf('people') ) {
                questioner_name = get_user_name( questioner_url );
                break;
            }
        }
        catch ( e ) {
           console.error('error');
        }
    }

    return questioner_name;
}

function try_to_get_attribute( node, attribute ) {

    console.log( 'try to get attribute from node: ' );
    console.log( node );
    var parent_node = node[0].parentNode;

    while ( true ) {

        if ( ! parent_node || parent_node == 'undefined' ) break;

        if ( parent_node.hasAttribute( attribute ) ) {
            var json_str = parent_node.getAttribute( attribute );
            console.log( 'Got json string from question log: ' + json_str );
            if ( json_str ) {
                return JSON.parse( json_str );
            }
        }

        console.log( 'parent node of parent node: ' );
        parent_node = parent_node.parentNode;
        console.log( parent_node );
    }
}

function get_url_from_sibling_element( current_node ) {

    console.log( current_node );

    var parent_node = current_node[0].parentNode;
    var child_node = current_node[0].childNodes;

    var json = try_to_get_attribute( current_node, 'data-zop' );

    var title_type;

    var video_url = '';

    console.log( 'Got json data: ' );
    console.log( json );
    if ( json && json.type == 'zvideo' ) {
        title_type = VIDEO_TYPE;
    }
    else if ( json && json.type == 'article' ) {
        title_type = ARTICLE_TYPE;
    }
    else if ( json && json.type == 'answer' ) {
        title_type = QUESTION_TYPE;
    }

    var target_url = '';
    for ( var item of child_node ) {
        var href = item.getAttribute('href');
        var question_url = item.getAttribute('content');

        if ( ! href && ! question_url ) continue;

        console.log(title_type);
        console.log( 'href: ' + href );
        console.log( 'question_url ' + question_url );
        if ( title_type == VIDEO_TYPE && href && href.length > 0 ) {
            target_url = href;
            break;
        }
        else if ( title_type == ARTICLE_TYPE && href && href.length > 0 ) {
            target_url = 'https:' + href;
            break;
        }
        else if ( question_url && question_url.indexOf('question') > 0 && question_url.indexOf('answer') < 0 ) {
            target_url = question_url + '/log';
            break;
        }
    }
    return [ target_url, title_type ];
}


function addCommentAuthorBlockButton( node ) {
    console.log('----------------------Commen Author Block Button Added-------------------------');

    var button = document.createElement("button");
    button.innerHTML = "&nbsp[拉黑] ";
    button.className = "Button CommentItemV2-hoverBtn Button--plain";
    button.type = "button"
    button.id = "comment_author_block_button";
    button.value = "block";

    if ( no_need_to_add_button( null, node, TITLE_TYPE ) ) return;
    node[0].appendChild( button );

    var parent_node = node[0].parentNode;
    if ( ! parent_node.getAttribute('class') ) {
        console.log('Remove old block button');
        for ( var item of parent_node.children ) {
            if ( item.getAttribute('id') == 'comment_author_block_button' ) {
                item.remove();
            }
        }
    }

    button.addEventListener (
        "click", function(){processBlockCommentAuthor(node, button)}, false
    );
}

function processBlockCommentAuthor( node, button ) {

    console.log('Block comment author button press');

    var author_name = get_comment_author( node[0] );
    if ( author_name && author_name.length > 0 ) {
        select_block_action( author_name, button );
    }
}

function get_comment_author( node ) {
    var grandparent = node.parentNode.parentNode;
    var target_data_node = grandparent.getElementsByClassName('UserLink-link');

    if ( target_data_node.length == 0 ) {
        console.log('get comment author failed in first time.');
        grandparent = grandparent.parentNode;
        target_data_node = grandparent.getElementsByClassName('UserLink-link');
    }
    console.log( target_data_node );

    var target_url = target_data_node[0].href;
    console.log( target_url );

    var author_name = get_user_name( target_url );
    return author_name;
}

function removeUnnessisaryButton(node){

    var target = ['举报', '喜欢', '分享', '收藏'];

    for ( var item of target ) {
        if ( node[0].innerHTML.indexOf(item) > 0 ) {
            node.remove();
            break;
        }
    }
}

