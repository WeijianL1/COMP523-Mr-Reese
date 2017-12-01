require('dotenv').config();
const stringifyObject = require('stringify-object');
var cheerio = require('cheerio');//for scrapper
// var Promise = require('promise');
var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var discovery_export = require('./discovery');
var sendToDiscovery = discovery_export.sendToDiscovery;
var getNews = discovery_export.getNews;
var addDocument = discovery_export.addDocument;
var queryNLP=require('./queryNLP');
var queryNLP_keywords=queryNLP.queryNLP_keywords;
var getWeather = require('./weather');
var sendEntities = require('./sendEntities');
//var addDocument = require('./addDocument');
var generateEntityArray = require('./generateEntityArray.js');
var schedule = require('node-schedule');
var rssParser = require('rss-parser');
var jsonfile = require('jsonfile');
var assert = require('assert');
var fs = require('file-system');
var mysql = require('mysql');

//globle vars 
var last_query;
var last_answer;
var last_answer_id;
var source;
var dbAnswerId;
var c_score;
process.env.TZ = 'America/New_York';

var url_dict_arr = [{
        category: "local",
        url: 'http://www.starnewsonline.com/news/local?template=rss&mime=xml'
    },
    // {
    //   category: "politics",
    //   url: 'http://www.starnewsonline.com/news/politics?template=rss&mime=xml' 
    // },
    {
        category: "national-world",
        url: 'http://www.starnewsonline.com/news/nation-world?template=rss&mime=xml'
    }, {
        category: "sports",
        url: 'http://www.starnewsonline.com/sports?template=rss&mime=xml'
    },
    // {
    //   category: "crime",
    //   url: 'http://www.starnewsonline.com/news/crime?template=rss&mime=xml' 
    // },

    {
        category: "entertainment",
        url: 'http://www.starnewsonline.com/entertainment?template=rss&mime=xml'
    }, {
        category: "lifestyle",
        url: 'http://www.starnewsonline.com/lifestyle?template=rss&mime=xml'
    }
];
// var postbackFlag=false;

var connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB
});
var pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB
});

var app = express();
app.enable('trust proxy')
app.use(function(req, res, next) {
    if (req.secure) {
        next();
    } else {
        res.redirect('https://' + req.headers.host + req.url);
    }
});

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({
    extended: false
}))
app.use(bodyParser.json())



//replace with your credential 
var conversation = new Conversation({
    // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
    // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
    username: process.env.CONVERSATION_USERNAME,
    password: process.env.CONVERSATION_PASSWORD,
    url: process.env.CONVERSATION_URL,
    version_date: Conversation.VERSION_DATE_2017_04_21
});

var j1 = schedule.scheduleJob("20 * * * *", function(){
  console.log("Doing scheduled job for local.");
  updateNewsWithRSS("local");
});

var j2 = schedule.scheduleJob("35 * * * *", function(){
  console.log("Doing scheduled job for national.");
  updateNewsWithRSS("national-world");
});

var j3 = schedule.scheduleJob("30 * * * *", function(){
  console.log("Doing scheduled job for sports.");
  updateNewsWithRSS("sports");
});

var j4 = schedule.scheduleJob("25 * * * *", function(){
  console.log("Doing scheduled job for entertainment.");
  updateNewsWithRSS("entertainment");
});

var j5 = schedule.scheduleJob("40 * * * *", function(){
  console.log("Doing scheduled job for lifestyle.");
  updateNewsWithRSS("lifestyle");
});

// var j = schedule.scheduleJob("*/3 * * * *", function() { //every 5 mins
//     console.log("Doing scheduled job.");
//     updateNewsWithRSS("entertainment");
// });

function parseURL(url, news_cat) {
    rssParser.parseURL(url, function(err, parsed) {
        //console.log(parsed.feed.title);
        var id = 0;
        parsed.feed.entries.forEach(function(entry) {
            //console.log(entry.title + ':' + entry.link);
            //console.log(entry.description);
            request({
                method: 'GET',
                url: entry.link
            }, function(err, response, body) {
                if (err) {
                    console.log(err);
                } else {
                	var $ = cheerio.load(body.toString());
                	// var $ = cheerio.load('<ul class="article-body"><li class="inner">Apple</li><li class="orange">Orange</li><li class="pear">Pear</li></ul>');
                	var html=$('.article-body').text();
                	// console.log("html: ",html);
                    var news_obj = {
                        "title": entry.title,
                        "url": entry.link,
                        "pubDate": entry.pubDate,
                        "description": entry.content,
                        "html": html,
                        "category": news_cat
                    };
                    addDocument(news_obj);
                }
            });

        });
    });
};

function updateNewsWithRSS(target_cat) {
    url_dict_arr.forEach(function(element) {
        var category = element.category;
        var url = element.url;
        console.log("category: " + category);
        console.log("url: " + url);
        if (category == target_cat) {
            parseURL(url, category);
        }
    });
};

// This code is called only when subscribing the webhook //
app.get('/webhook/', function(req, res) {
    if (req.query['hub.verify_token']) {
        res.send(req.query['hub.challenge']);
        console.log("webhook got");
    }
    res.send('Error, wrong validation token');
});

// Incoming messages reach this end point //
app.post('/webhook/', function(req, res) {
    //console.log("getting post from webhook.");
    // console.log("url: "+process.env.WORKSPACE_URL);
    var context;
    var workspace = process.env.WORKSPACE_ID;
    if (!workspace) {
        console.log("conversation workspace not configured");
        return res.json({
            'output': {
                'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
            }
        });
    }
    //facebook endpoint
    messaging_events = req.body.entry[0].messaging;

    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i];
        var sender = event.sender.id;

        if (event.message && event.message.attachments && event.message.attachments[0].type == 'location') {
            var lat = event.message.attachments[0].payload.coordinates.lat;
            var long = event.message.attachments[0].payload.coordinates.long;
            console.log("lat: ", lat, "long: ", long);

            var responseChunck = getWeather(lat, long);
            responseChunck.then(function(response) {
                var weather_text = response[0];
                sendMessage(sender, weather_text);
            });
            res.sendStatus(200);
        } else if (event.message && event.message.attachments) {
            var attachment_failure = "Sorry, I cannot handle that yet.";
            sendMessage(sender, attachment_failure);
            res.sendStatus(200);
        } else if (event.message && event.message.text) {
            text = event.message.text;
            text = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ');
            var inputObj = {
                'text': text
            };
            var payload = {
                workspace_id: workspace,
                //context is for keep the progress of a conversation, I haven't figure it out
                context: context || {},
                input: inputObj,
            };
            console.log("payload: " + payload.input.text + "---" + payload.workspace_id);
            // Send the input to the conversation service
            conversation.message(payload, function(err, data) {
                if (err) {
                    console.log("err:" + err);
                    // console.log("2: "+obj(err));
                    res.sendStatus(502);
                } else {
                    res.sendStatus(200);
                    var updatedMsg = updateMessage(text, data, sender);
                    updatedMsg.then(function(response) {
                        if (response[0] && response[0] == "list") {
                            sendTemplateList(sender, response[1], response[2], response[3], response[4], response[5]);
                            //sendMessage(sender, "fuck");
                        } else if (response.output.text.toString() != "") {
                            sendMessage(sender, response.output.text.toString());
                        }
                        
                    });
                }
            });
            // postbackFlag=true;
            // event.postback=false;

        } else if (event.postback && event.postback.payload) {
            // postbackFlag=false;
            console.log("Getting postback from webhook.");
            if (event.postback.payload == "relevant") {
                var relevance = 10;
                insertQnA(connection, last_answer, last_query, 1, sender);
                sendMessage(sender, "Thanks for your feedback. I'm looking forward to see your again!");
            } else if (event.postback.payload == "irrelevant") {
                var relevance = 0;
                source="";
                insertQnA(connection, '0', last_query, 0, sender);
                sendMessage(sender, "I'm sorry that my answer does not solve your problem. Your feedback will help to improve my answer.");
            } else {
                console.log("payload value not recognized.");
            }

            var example = {
                document_id: last_answer_id,
                relevance: relevance
            };

            var examples = [];
            examples.push(example);

            var dataString = {
                natural_language_query: last_query,
                examples: examples
            };
            if (source == "Star News") {
                var url = 'https://gateway.watsonplatform.net/discovery/api/v1/environments/' + process.env.ENVIRONMENT_ID + '/collections/' + process.env.NEWS_COLLECTION_ID + '/training_data?version=2017-09-01';
            } else if (source == "Spreadsheet") {
                var url = 'https://gateway.watsonplatform.net/discovery/api/v1/environments/' + process.env.ENVIRONMENT_ID + '/collections/' + process.env.COLLECTION_ID + '/training_data?version=2017-09-01';
            } else {
                console.log("source should never be google!");
                // assert.equal(source, "Google");
                // assert.equal(1, 0);
            }
            var options = {
                url: url,
                method: 'POST',
                json: true,
                body: dataString,
                auth: {
                    'user': process.env.DISCOVERY_USERNAME,
                    'pass': process.env.DISCOVERY_PASSWORD
                }
            };
            function callback(error, response, body) {
                if (!error && response.statusCode == 200) {
                    console.log(body);
                } else if (error) {
                    console.log("Error: " + error);
                }
            }
            request(options, callback);
            console.log("sent feedback to discovery.");
            res.sendStatus(200);
        }
    }
});

function insertQnA(connection, lA, lQ, success, senderId) {
    pool.getConnection(function(err, connection) {
        // var query1='INSERT INTO answers (answer_content) SELECT "'+lA+'" FROM DUAL WHERE NOT EXISTS (SELECT * FROM answers WHERE answer_content="'+lA+'") LIMIT 1';
        connection.query('INSERT INTO answers (answer_content) SELECT "' + lA + '" FROM DUAL WHERE NOT EXISTS (SELECT * FROM answers WHERE answer_content="' + lA + '") LIMIT 1', function(error, results, fields) {
            if (error) {
                console.log("answer: " + error.code + results[0].solution);
            } else {
                connection.query('SELECT id as id FROM answers where answer_content="' + lA + '"', function(error, results, fields) {
                    if (error) {
                        console.log("answer2: " + error.code + results[0].solution);
                    } else {
                        dbAnswerId = results[0].id;
                        var queryForKeywords=queryNLP_keywords(lQ);
                        queryForKeywords.then(function(response){
                        	var keywords=response[0];
                        	var query = 'INSERT INTO qna (question_content,answer_id,success,user_id,keywords,source,confidence) VALUE ("' + lQ + '",' + dbAnswerId + ',' + success + ',' + senderId+',"' + keywords+'","' + source+'",'+c_score+')';
                        	connection.query(query, function(error, results, fields) {
                        	    if (error) {
                        	        console.log("QnA:" + error.code);
                        	    } else {
                        	        console.log('insert done');
                        	    }
                        	});
                        });
                    }
                });
            }
        });
        connection.release();
    });
};

function updateMessage(input, cv_response, sender) {
    console.log("updateMessage Called.");
    return new Promise(function(resolve, reject) {
        var intent = '';
        var entitesArray;
        var responseText;
        var responseChunck;
        var responseWords = cv_response.output.text.toString();
        if (typeof cv_response.intents[0] != 'undefined') { //has an intent
            intent = cv_response.intents[0].intent.toString();
        }
        if (intent == '' || intent == 'question' || responseWords == '') {
            console.log("question intent.")
            last_query = input;
            responseChunck = sendToDiscovery(input, 'title');
            responseChunck.then(function(response) {
                console.log("sendToDiscovery returned.");
                last_answer = response.answer_txt;
                last_answer_id = response.id;
                source = response.source;
                c_score=parseFloat(response.score/5.0*100).toFixed(2);
                cv_response.output.text=response.answer_txt;
                if(c_score<40&&source!="Google"){
                	 cv_response.output.text +="\n\nI am only "+c_score+"% sure about this answer. Please leave a feedback if it is not what you want.";
                }
                console.log("answer_id:" + last_answer_id);
                resolve(cv_response);
                if (source == "Star News" ) {
                    console.log("source: " + source);
                    last_answer=response.title+"\n"+response.url;
                    sendTemplate(sender, response.title, response.url);
                }
                if (last_answer_id != 0) {
                    setTimeout(function() {
                        sendFeedbackButton(sender);
                    }, 2000);
                    console.log("Waited 2 seconds.")
                }
            });
        }else if(intent=='event'){
        	cv_response.output.text = "This might be helpful: \n http://starnewsonline.eviesays.com/?/events";
        	resolve(cv_response);
        } 
        else if (intent == 'weather') {
            sendLocationRequest(sender);
            cv_response.output.text = ""; //set text to empty, so that it wont go thru send message
            resolve(cv_response);
        } else if (intent == 'news') {
            console.log("detect news intent.");
            responseChunck = getNews();
            responseChunck.then(function(response) {
                console.log("getNews returned.");
                //cv_response.output.text = "skip";
                resolve(["list", response[0], response[1], response[2], response[3], response[4]]);
            });
        } else {
            console.log("Other intents.")
            last_query = null;
            resolve(cv_response);
        }
    });
};


function sendLocationRequest(sender) {
    var msg_payload = {
        text: "Please send your location: ",
        quick_replies: [{
            "content_type": "location"
        }]
    };
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: msg_payload,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error in message: ', response.body.error);
        } else {
            console.log('location quick reply done');
        }
    });
};


function sendFeedbackButton(sender) {
    var button1 = {
        type: "postback",
        title: "Relevant",
        payload: "relevant"
    };
    var button2 = {
        type: "postback",
        title: "Not Relevant",
        payload: "irrelevant"
    };
    var button_payload = {
        template_type: "button",
        text: "Could you please rate my response regarding its relevance to your question?",
        buttons: [button1, button2]
    };

    var attachment_obj = {
        type: "template",
        payload: button_payload
    };

    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: {
                attachment: attachment_obj
            },
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending button: ', error);
        } else if (response.body.error) {
            console.log('Error in button: ', response.body.error);
        }
    });
    console.log("fbid: " + sender + "---" + "BUTTON");
};

function sendTemplate(sender, title, url) {
    console.log("sendTemplate called.");
    // var image_link;
    request({
        method: 'GET',
        url: url
    }, function(err, response, body) {
        if (err) {
            console.log(err);
        } else {
        	var $ = cheerio.load(body.toString());
        	var image_link=$('.image').children('img').attr('src').toString()||"http://www.starnewsonline.com/Global/images/head/nameplate/starnewsonline_logo.png";
            if(image_link!="http://www.starnewsonline.com/Global/images/head/nameplate/starnewsonline_logo.png"){
        	   var cut_idex=image_link.search("&");
        	   var image_link=image_link.slice(0,cut_idex+1)+"MaxH=500&MaxW=500";
            }

        	// console.log(image_link);

        	var element = {
        	    title: title,
        	    image_url: image_link,
        	    default_action: {
        	        type: "web_url",
        	        url: url,
        	        //messenger_extensions: true,
        	        webview_height_ratio: "tall"
        	    },
        	    buttons: [{
        	        type: "web_url",
        	        url: url,
        	        title: "View Article"
        	    }]
        	};

        	var payloadData = {
        	    template_type: "generic",
        	    elements: [element]
        	};
        	var attachmentData = {
        	    type: "template",
        	    payload: payloadData
        	};
        	console.log("before sending http request.");
        	request({
        	    url: 'https://graph.facebook.com/v2.6/me/messages',
        	    qs: {
        	        access_token: token
        	    },
        	    method: 'POST',
        	    json: {
        	        recipient: {
        	            id: sender
        	        },
        	        message: {
        	            attachment: attachmentData
        	        }
        	        //message: {text: "fuck"}
        	    }
        	}, function(error, response, body) {
        	    if (error) {
        	        console.log('Error sending message: ', error);
        	    } else if (response.body.error) {
        	        console.log('Error in message: ', response.body.error);
        	    }
        	});
        	console.log("sendTemplate fbid: " + sender + "---" + "fb messageData: " + "fuck");
        }
    });
    
};

function sendTemplateList(sender, news1, news2, news3, news4, news5) {
    var img_url = "http://www.starnewsonline.com/Global/images/head/nameplate/starnewsonline_logo.png";
    var element1 = {
        title: news1.title,
        image_url: img_url,
        subtitle: news1.description,
        default_action: {
            type: "web_url",
            url: news1.url,
            //messenger_extensions: true,
            webview_height_ratio: "tall"
        },
        buttons: [{
            type: "web_url",
            url: news1.url,
            title: news1.category
        }]
    };
    var makeElement = function(news) {
        console.log("Category: " + news.category);
        var element = {
            title: news.title,
            subtitle: news.description,
            default_action: {
                type: "web_url",
                url: news.url,
                //messenger_extensions: true,
                webview_height_ratio: "tall"
            },
            buttons: [{
                type: "web_url",
                url: news.url,
                title: news.category
            }]
        };
        return element;
    };
    var element2 = makeElement(news2);
    var element3 = makeElement(news3);
    var element4 = makeElement(news4);
    var element5 = makeElement(news5);
    var payloadData = {
        template_type: "list",
        top_element_style: "large",
        elements: [element1, element2, element3, element4]
    };
    var attachmentData = {
        type: "template",
        payload: payloadData
    };
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: token
        },
        method: 'POST',
        json: {
            recipient: {
                id: sender
            },
            message: {
                attachment: attachmentData
            }
            //message: {text: "fuck"}
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending message: ', error);
        } else if (response.body.error) {
            console.log('Error in message: ', response.body.error);
        }
    });
    console.log("fbid: " + sender + "---" + "fb messageData: " + "fuck");
};

// This function receives the response text and sends it back to the user //
function sendMessage(sender, txt) {
    messageData = {
        text: txt
    }
    var msg;
    var numMsg = txt.length / 600 + 1;
    for (var i = 0; i < numMsg; i++) {
        if (i == numMsg - 1) {
             msg = txt.slice(i * 600);
        } else {
             msg = txt.slice(i * 600, i * 600 + 600);
        }
        request({
            url: 'https://graph.facebook.com/v2.6/me/messages',
            qs: {
                access_token: token
            },
            method: 'POST',
            json: {
                recipient: {
                    id: sender
                },
                message: {
                    text: msg
                },
            }
        }, function(error, response, body) {
            if (error) {
                console.log('Error sending message: ', error);
            } else if (response.body.error) {
                console.log('Error in message: ', response.body.error);
            }
        });
    }
    console.log("fbid: " + sender + "---" + "fb messageData: " + txt);
};

var token = process.env.FB_TOKEN;
var host = (process.env.VCAP_APP_HOST || 'localhost');
var port = (process.env.VCAP_APP_PORT || 3000);
app.listen(port, host);