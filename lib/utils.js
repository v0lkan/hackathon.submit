var http = require('http');

/**
 * Trim left, right and lower case the given string
 *
 * @param  {String} string
 * @return {String}
 */
exports.stringCleanup = function(string) {
    return String(string)
        .trimLeft()
        .trimRight()
        .toLowerCase();
};

exports.escape = function(html) {
    return String(html)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

/**
 * Unescape special characters in the given string of html.
 *
 * @param  {String} html
 * @return {String}
 */
exports.unescape = function(html) {
    return String(html)
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, '\'')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
};

/**
 * Shorten the given url using google service
 *
 * @param {String} url
 * @return {String}
 */
exports.shortenUrl = function(url) {
    return String(url);
};

exports.ss_raw_get = function(phrase, callback) {
    var url = 'http://api.seslisozluk.com?key=e8764852f9d58beb1b98bdd7e00b5ff9&query=' + encodeURIComponent(phrase);

    http.get(url, function(r) {
        console.log("Got response: " + r.statusCode);

        var result = '';

        r.setEncoding('utf8');
        r.on('data', function (chunk) {
            result += chunk;
        });

        r.on('end', function() {
            try {
                JSON.parse(result);
            } catch (ignore) {
                callback(true, null);

                return;
            }
            callback(null, String(result));
        });
    }).on('error', function(e) {
        console.log("Got error: " + e.message);
        callback(true, null);
    });
};