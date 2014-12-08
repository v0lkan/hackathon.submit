'use strict';

// TODO: add button
// TODO: share button
// TODO: error page
// TODO: cleanup

var express = require('express'),
    app = express(),

    expressHbs = require('express-handlebars'),
    bodyParser = require('body-parser'),
    random = require('o2.random'),
    redis = require('redis'),
    http = require('http'),

    UrlShorter = require('node-url-shorter'),

    utils = require('./lib/utils'),

    db = redis.createClient();

app.engine('hbs', expressHbs({extname:'hbs', defaultLayout:'main.hbs'}));
app.set('view engine', 'hbs');

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', function(req, res) {
    res.render('index', {pageId: 'wb-index'});
});

app.get('/words/list/:data', function(req, res) {
    var data = req.params.data;

    if (!data) {
        console.log('redirect 001');

        res.redirect('/');
        res.end();

        return;
    }

    db.hgetall('wl_' + data, function(err, phraseMetaPairs) {
        if (err) {
            console.log('redirect 002');

            res.redirect('/');
            res.end();

            return;
        }

        var phrase,
            descriptionJson,
            translations,
            englishDescriptions,
            templateData = [];

        console.log('debug');

        for (phrase in phraseMetaPairs) {
            if (phraseMetaPairs.hasOwnProperty(phrase)) {
                englishDescriptions = [];

                try {
                    descriptionJson = JSON.parse(phraseMetaPairs[phrase]);
                } catch (ignore) {
                    console.log('redirect 003');

                    res.redirect('/');
                    res.end();

                    return;
                }

                translations = descriptionJson.translations;

                if (translations) {
                    console.log('we have translations');
                    console.log(translations);

                    translations
                        .filter(function(t) {return t.lang_pair === 'en-en'})
                        .forEach(function(t) {
                            englishDescriptions.push(
                                {translation: t.translation}
                            );
                        });
                } else {
                    console.log('no translations dude :(');
                    //console.log(typeof descriptionJson);
                    //console.log(descriptionJson);
                }

                templateData.push({
                  phrase: phrase,
                  descriptions: englishDescriptions
                });
            }
        }

        console.log('template data:');
        console.log(templateData);

        res.render('list', {
            pageId: 'wb-list',
            data: templateData,
            count: templateData.length,
            single: (templateData.length <= 1),
            show_bottom_actions: (templateData.length > 2)
        });
    });
});

app.post('/words/create', function(req, res) {
    var phrase = req.body.phrase;

    if (!phrase) {
        res.redirect('/');
        res.end();

        return;
    }

    phrase = utils.stringCleanup('' + req.body.phrase);

    db.hget('phrases', phrase, function(err, data) {
        if (err) {
            res.redirect('/');
            res.end();

            return;
        }

        if (!data) {
            //res.write('the fucking data is undefined');
            //res.end();

            // TODO: if data undefined get data from sozluk api.

            var url = 'http://api.seslisozluk.com?key=e8764852f9d58beb1b98bdd7e00b5ff9&query=' + encodeURIComponent(phrase);

            http.get(url, function(r) {
                console.log("Got response: " + r.statusCode);

                var result = '';

                r.setEncoding('utf8');
                r.on('data', function (chunk) {
                    result += chunk;
                });

                r.on('end', function() {
                    random.generateSecureRandom(32, function(err, randomData) {
                        if (err) {
                            res.redirect('/');
                            res.end();

                            return;
                        }

                        db.hset('phrases', phrase, result, function(err) {
                            if (err) {
                                res.redirect('/');
                                res.end();

                                return;
                            }

                            db.hset('wl_' + randomData, phrase, result, function(err) {
                                if (err) {
                                    res.redirect('/');
                                    res.end();

                                    return;
                                }

                                res.redirect('/words/list/' + randomData);
                                res.end();
                            });
                        });
                    });
                });
            }).on('error', function(e) {
                console.log("Got error: " + e.message);
            });

            //res.redirect('/');
            //res.end();

            return;
        }

        //try {
        //    JSON.parse(data);
        //} catch (ignore) {
        //    res.redirect('/');
        //    res.end();
        //
        //    return;
        //}

        random.generateSecureRandom(32, function(err, randomData) {
            if (err) {
                res.redirect('/');
                res.end();

                return;
            }

            db.hset('wl_' + randomData, phrase, data, function(err) {
                if (err) {
                    res.redirect('/');
                    res.end();

                    return;
                }

                res.redirect('/words/list/' + randomData);
                res.end();
            });
        });
    });
});

////////////////////////////////////////////////////////////////////////////////

app.post('/api/shorten', function(req, res) {
    var list_id = req.body.list_id;

    if (!list_id) {
        res.redirect('/');
        res.end();

        return;
    }

    list_id = '' + req.body.list_id;
    list_id = utils.stringCleanup(list_id);

    db.exists('wl_' + list_id, function(err, data) {

        if (err) {
            res.redirect('/');
            res.end();

            return;
        }

        if (!data) {
            console.log('List id not found ' + list_id);
            res.write(list_id);
            res.end();

            return;
        }

        var fqdn = "http://v0lk4n.koding.io";
        var long_url =  fqdn + "/words/list/" + list_id;

        UrlShorter
            .getShortUrl(long_url)
            .then(function(data){
                console.log('getShortUrl success = ', data);
                res.write(data.id);
                res.end();
            })
            .fail(function(err){
                console.log('getShortUrl fail err = ', err);
                res.write('error');
                res.end();
            });
    });
});

app.post('/api/words/add', function(req, res) {
    var list_id = req.body.list_id;
    var phrase = req.body.phrase;

    if (!list_id) {
        res.write('error');
        res.end();

        return;
    }

    if (!phrase) {
        res.write('error');
        res.end();

        return;
    }

    list_id = '' + req.body.list_id;
    list_id = utils.stringCleanup(list_id);

    phrase = '' + req.body.phrase;
    phrase = utils.stringCleanup(phrase);

    db.exists('wl_' + list_id, function(err, data) {

        if (err) {
            res.write('error');
            res.end();

            return;
        }

        db.hexists('phrases', phrase, function(err, data) {
            if (err) {
                res.write('error');
                res.end();
                return;
            }


            if (!data) {
                console.log('We dont have ' + phrase + ' word in our db. Asking seslisozluk API!');

                utils.ss_raw_get(phrase, function(err, result) {
                    if (err) {
                        console.log('This word doesnt exist in seslisozluk api..');
                        res.write('error');
                        res.end();
                        return;
                    }

                    console.log('Writing ' + phrase + ' to phrases and wl_ sets:');
                    db.hset('phrases', phrase, result, function(err) {
                        if (err) {
                            res.write('error');
                            res.end();

                            return;
                        }

                        db.hset('wl_' + list_id, phrase, result, function(err) {
                            if (err) {
                                res.write('error');
                                res.end();

                                return;
                            }
                            res.write('ok');
                            res.end();
                        });
                    });
                });

                return;
            }

            console.log('Found ' + phrase + ' in our db! Writing to wl_ set only');

            //Get word from our db
            db.hget('phrases', phrase, function(err, data) {

                if (err) {
                    res.error('error');
                    res.end();

                    return;
                }

                if (!data) {
                    res.write('error');
                    res.end();
                }

                //Add word to user's db
                db.hset('wl_' + list_id, phrase, data, function(err) {
                    if (err) {
                        res.write('error');
                        res.end();

                        return;
                    }

                    res.write('ok');
                    res.end();
                });

            });
        });
    });


});

app.post('/api/words/delete', function(req, res) {
    var list_id = req.body.list_id;
    var phrase = req.body.phrase;

    if (!list_id) {
        res.write('error');
        res.end();

        return;
    }

    if (!phrase) {
        res.write('error');
        res.end();

        return;
    }

    list_id = '' + req.body.list_id;
    list_id = utils.stringCleanup(list_id);

    phrase = '' + req.body.phrase;
    phrase = utils.stringCleanup(phrase);

    db.exists('wl_' + list_id, function(err, data) {

        if (err) {
            res.write('error');
            res.end();

            return;
        }

        if (!data) {
            console.log('List id not found ' + list_id);
            res.write('error');
            res.end();
            return;
        }

        db.hdel('wl_' + list_id, phrase, function(err) {
            if (err) {
                res.write('error');
                res.end();

                return;
            }

            res.write('ok');
            res.end();

        });
    });
});

app.listen(80);
