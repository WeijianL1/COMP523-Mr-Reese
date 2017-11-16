require('dotenv').config();
const stringifyObject = require('stringify-object');
// var Promise = require('promise');
var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var discovery_export = require('./discovery');
var sendToDiscovery = discovery_export.sendToDiscovery;
var getNews = discovery_export.getNews;
var addDocument = discovery_export.addDocument;
var getWeather = require('./weather');
var sendEntities = require('./sendEntities');
//var addDocument = require('./addDocument');
var generateEntityArray = require('./generateEntityArray.js');
var schedule = require('node-schedule');
var rssParser = require('rss-parser');
var jsonfile = require('jsonfile');
var assert = require('assert');
var fs = require('file-system');
var mysql= require('mysql');
var last_query;
var last_answer;
var last_answer_id;
var is_from_news;
var dbAnswerId;
// var postbackFlag=false;

var connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USERNAME,
  password : process.env.DB_PASSWORD,
  database : process.env.DB
});
var pool  = mysql.createPool({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USERNAME,
  password : process.env.DB_PASSWORD,
  database : process.env.DB
});

var app = express();
app.enable('trust proxy')
app.use(function(req, res, next) {
	if(req.secure) {
		next();
	} else {
		res.redirect('https://' + req.headers.host + req.url);
	}
});

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())



//replace with your credential 
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  username: process.env.CONVERSATION_USERNAME,
  password: process.env.CONVERSATION_PASSWORD,
  url:process.env.CONVERSATION_URL,
  version_date: Conversation.VERSION_DATE_2017_04_21
});

// var rule = new schedule.RecurrenceRule();
// rule.dayOfWeek = 0;
// rule.hour = 1;
// rule.minute = 7;
 
var j = schedule.scheduleJob("15 20 * * *", function(){
  console.log("Doing scheduled job.");
  updateNewsWithRSS();
});

function updateNewsWithRSS() {
  rssParser.parseURL('http://www.starnewsonline.com/news/local?template=rss&mime=xml', function(err, parsed) {
    //console.log(parsed.feed.title);
    var id = 0;
    parsed.feed.entries.forEach(function(entry) {
      //console.log(entry.title + ':' + entry.link);
      //console.log(entry.description);
      var news_obj = {
        "title": entry.title,
        "url": entry.link,
        "pubDate": entry.pubDate
        //"description": entry.description
      };
      addDocument(news_obj);      
    });
  });
}; 

// This code is called only when subscribing the webhook //
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token']) {
        res.send(req.query['hub.challenge']);
        console.log("webhook got");
    }
    res.send('Error, wrong validation token');
});

// Incoming messages reach this end point //
app.post('/webhook/', function (req, res) {
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
    sender = event.sender.id;

    if(event.message&&event.message.attachments&&event.message.attachments[0].type=='location'){
      var lat=event.message.attachments[0].payload.coordinates.lat;
      var long=event.message.attachments[0].payload.coordinates.long;
      console.log("lat: ",lat,"long: ",long);

      var responseChunck = getWeather(lat,long);
      responseChunck.then(function(response) {
        var weather_text = response[0];
        sendMessage(sender,weather_text);
      });
      res.sendStatus(200);
    }
    else if(event.message&&event.message.attachments){
      var attachment_failure="Sorry, I cannot handle that yet.";
      sendMessage(sender,attachment_failure);
      res.sendStatus(200);
    }
    else if (event.message && event.message.text) {
      text = event.message.text;
      text = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g,' ');
      var inputObj={'text':text};
      var payload = {
        workspace_id: workspace,
        //context is for keep the progress of a conversation, I haven't figure it out
        context: context||{},
        input: inputObj,
      };
      console.log("payload: "+payload.input.text+"---"+payload.workspace_id);
      // Send the input to the conversation service
      conversation.message(payload, function(err, data) {
        if (err) {
          console.log("err:"+err);
          // console.log("2: "+obj(err));
          res.sendStatus(502);
        }
        else {
        	var updatedMsg=updateMessage(text,data);
        	updatedMsg.then(function(response){
            if (response[0] && response[0] == "list") {
              sendTemplateList(sender, response[1], response[2], response[3]);
              //sendMessage(sender, "fuck");
            }
            else if(response.output.text.toString()!=""){
          		sendMessage(sender,response.output.text.toString());
            }
        		res.sendStatus(200);
        	});
        }
      });
      // postbackFlag=true;
      // event.postback=false;
      
    } else if(event.postback && event.postback.payload) {
      // postbackFlag=false;
      console.log("Getting postback from webhook.");
      if (event.postback.payload == "relevant") {
        var relevance = 10;
        insertQnA(connection,last_answer,last_query,1,sender);
        sendMessage(sender,"Thanks for your feedback. I'm looking forward to see your again!");
      } else if (event.postback.payload == "irrelevant") {
        var relevance = 0;
        insertQnA(connection,'0',last_query,0,sender);
        sendMessage(sender,"I'm sorry that my answer does not solve your problem. Your feedback will help to improve my answer.");
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
      if (is_from_news == 1) {
        var url = 'https://gateway.watsonplatform.net/discovery/api/v1/environments/' + process.env.ENVIRONMENT_ID +'/collections/' + process.env.NEWS_COLLECTION_ID + '/training_data?version=2017-09-01';
      }
      else if (is_from_news == 0) {
        var url = 'https://gateway.watsonplatform.net/discovery/api/v1/environments/' + process.env.ENVIRONMENT_ID +'/collections/' + process.env.COLLECTION_ID + '/training_data?version=2017-09-01';
      }
      else {
        console.log("is_from_news should never be -1!");
        assert.equal(is_from_news, -1);
        assert.equal(1, 0);
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
        } else if (error){
          console.log("Error: " + error);
        }
      }
      request(options, callback);
      console.log("sent feedback to discovery.");
      res.sendStatus(200);
    }
  }
});

function insertQnA(connection,lA,lQ,success,senderId){
	pool.getConnection(function(err, connection) {
		// var query1='INSERT INTO answers (answer_content) SELECT "'+lA+'" FROM DUAL WHERE NOT EXISTS (SELECT * FROM answers WHERE answer_content="'+lA+'") LIMIT 1';
		connection.query('INSERT INTO answers (answer_content) SELECT "'+lA+'" FROM DUAL WHERE NOT EXISTS (SELECT * FROM answers WHERE answer_content="'+lA+'") LIMIT 1', function (error, results, fields) {
		if (error){console.log("answer: "+error.code+results[0].solution);
			}
		else{
			connection.query('SELECT id as id FROM answers where answer_content="'+lA+'"', function (error, results, fields) {
			if (error){console.log("answer2: "+error.code+results[0].solution);
				}
			else{
				dbAnswerId=results[0].id;
				console.log('The id is: '+dbAnswerId);
				var query='INSERT INTO qna (question_content,answer_id,success,user_id) VALUE ("'+lQ+'",'+dbAnswerId+','+success+','+senderId+')';
				connection.query(query, function (error, results, fields) {
					if (error){console.log("QnA:"+error.code+results[0].solution);}
					else{
						console.log('insert done');
					}
				});
			}
			});
		}
	});
		connection.release();
	  	});
	  	
};

function updateMessage(input, cv_response) {
  console.log("updateMessage Called.");
  return new Promise(function(resolve, reject) {
  	var intent='';
  	var entitesArray;
  	var responseText;
  	var responseChunck;
  	var responseWords=cv_response.output.text.toString();
  	if(typeof cv_response.intents[0]!='undefined'){  //has an intent
  		intent=cv_response.intents[0].intent.toString();
  	}
  	if(intent==''||intent=='question'||responseWords==''){
      console.log("question intent.")
  		last_query=input;
  		responseChunck = sendToDiscovery(input,'title');
  		// console.log(score);
  		// console.log("discovery case");
  		// if(typeof cv_response.entities[0]!='undefined'){//has entites
  		// 	console.log("has entites");
  		// 	var entitesArray=generateEntityArray(cv_response);
  		// 	console.log(entitesArray);
  		// 	responseText=sendToDiscovery(entitesArray,'entity');
  		// }else{
  		// 	console.log("no entites");
  		//  	responseText = sendToDiscovery(input,'title');
  		// 	// console.log("responseTExt: "+stringifyObject(responseText).replace('\n','--'));
  		// }
  		responseChunck.then(function(response) {
        // var confidence="\n My confidence level is: ",parseFloat(response[5])/5.0*100,"%";
  		  cv_response.output.text = response[0];
        last_answer = response[0];
        last_answer_id = response[1];
        is_from_news = response[2]
  		  resolve(cv_response);
        if (is_from_news == 1 || true) {
          console.log(is_from_news);
          sendTemplate(sender, response[3], response[4]);
        }
        if(last_answer_id != 0) {
          setTimeout(function() {
            sendFeedbackButton(sender);
          }, 5000);
          console.log("Waited 5 seconds.")
        }
  		});
    } 
    else if (intent=='weather') {
      sendLocationRequest();
      cv_response.output.text = "";//set text to empty, so that it wont go thru send message
      resolve(cv_response);
    }
    else if (intent=='news') {
      responseChunck = getNews();
      responseChunck.then(function(response) {
        //cv_response.output.text = "skip";
        resolve(["list", response[0], response[1], response[2]]);
      });
  	} 
    else{
      console.log("Other intents.")
  		last_query=null;
  		resolve(cv_response);
  	}
  });
};


function sendLocationRequest(){
  var msg_payload={
    text: "Please send your location: ",
    quick_replies:[
      {
      "content_type":"location"
      }
    ]
  };
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: token},
    method: 'POST',
    json: {
      recipient: {id: sender},
      message: msg_payload,
    }
  }, function (error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error in message: ', response.body.error);
    }else{
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
    qs: {access_token: token},
    method: 'POST',
    json: {
      recipient: {id: sender},
      message: {attachment: attachment_obj},
    }
  }, function (error, response, body) {
    if (error) {
      console.log('Error sending button: ', error);
    } else if (response.body.error) {
      console.log('Error in button: ', response.body.error);
    }
  });
  console.log("fbid: "+sender+"---"+"BUTTON");
};

function sendTemplate(sender, title, url) {
  var element = {
    title: title,
    image_url: "http://www.starnewsonline.com/Global/images/head/nameplate/starnewsonline_logo.png",
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
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: token},
    method: 'POST',
    json: {
      recipient: {id: sender},
      message: {attachment: attachmentData}
      //message: {text: "fuck"}
    }
  }, function (error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error in message: ', response.body.error);
    }
  });
  console.log("fbid: "+sender+"---"+"fb messageData: "+"fuck");
};

function sendTemplateList(sender, news1, news2, news3) {
  var element1 = {
    title: news1.title,
    image_url: "http://www.starnewsonline.com/Global/images/head/nameplate/starnewsonline_logo.png",
    // default_action: {
    //   type: "web_url",
    //   url: news1.url,
    //   //messenger_extensions: true,
    //   webview_height_ratio: "tall"
    // },
    buttons: [{
      type: "web_url",
      url: news1.url,
      title: "View Article"
    }]
  };
  var element2 = {
    title: news2.title,
    default_action: {
      type: "web_url",
      url: news2.url,
      //messenger_extensions: true,
      webview_height_ratio: "tall"
    },
    buttons: [{
      type: "web_url",
      url: news2.url,
      title: "View Article"
    }]
  };
  var element3 = {
    title: news3.title,
    default_action: {
      type: "web_url",
      url: news3.url,
      //messenger_extensions: true,
      webview_height_ratio: "tall"
    },
    buttons: [{
      type: "web_url",
      url: news3.url,
      title: "View Article"
    }]
  };

  var payloadData = {
    template_type: "list",
    top_element_style: "large",
    elements: [element1, element2, element3]
  };
  var attachmentData = {
    type: "template",
    payload: payloadData
  };
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token: token},
    method: 'POST',
    json: {
      recipient: {id: sender},
      message: {attachment: attachmentData}
      //message: {text: "fuck"}
    }
  }, function (error, response, body) {
    if (error) {
      console.log('Error sending message: ', error);
    } else if (response.body.error) {
      console.log('Error in message: ', response.body.error);
    }
  });
  console.log("fbid: "+sender+"---"+"fb messageData: "+"fuck");
};

// This function receives the response text and sends it back to the user //
function sendMessage(sender,txt) {
  messageData = {
    text: txt
  }
  var numMsg=txt.length/600+1;
  for(var i=0;i<1;i++){
    if(i==numMsg-1){var msg=txt.slice(i*600);}
    else{var msg=txt.slice(i*600,i*600+600);}
    request({
      url: 'https://graph.facebook.com/v2.6/me/messages',
      qs: {access_token: token},
      method: 'POST',
      json: {
        recipient: {id: sender},
        message: {text:msg},
      }
    }, function (error, response, body) {
      if (error) {
        console.log('Error sending message: ', error);
      } else if (response.body.error) {
        console.log('Error in message: ', response.body.error);
      }
    });
  }
  console.log("fbid: "+sender+"---"+"fb messageData: "+txt);
};

var token= process.env.FB_TOKEN;
var host = (process.env.VCAP_APP_HOST || 'localhost');
var port = (process.env.VCAP_APP_PORT || 3000);
app.listen(port, host);
