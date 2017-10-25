require('dotenv').config();
const stringifyObject = require('stringify-object');
// var Promise = require('promise');
var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var sendToDiscovery = require('./discovery');
var sendEntities = require('./sendEntities');
var addDocument = require('./addDocument');
var generateEntityArray = require('./generateEntityArray.js');
var schedule = require('node-schedule');
var rssParser = require('rss-parser');
var jsonfile = require('jsonfile');
var fs = require('file-system');
var mysql= require('mysql');
var last_query;
var last_answer;
var last_answer_id;
var dbAnswerId;
var successFlag;

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
 
var j = schedule.scheduleJob("10 0 * * *", function(){
  console.log("Doing scheduled job.");
  updateNewsWithRSS();
});



function updateNewsWithRSS() {
  rssParser.parseURL('http://www.starnewsonline.com/news/local?template=rss&mime=xml', function(err, parsed) {
    console.log(parsed.feed.title);
    var id = 0;
    parsed.feed.entries.forEach(function(entry) {
      console.log(entry.title + ':' + entry.link);
      var news_obj = {
        "title": entry.title,
        "url": entry.link,
        // description: entry.description
      };
      addDocument(news_obj);
      console.log("writefile success!");
      
    });
  });

}; 

// This code is called only when subscribing the webhook //
app.get('/webhook/', function (req, res) {
    if (req.query['hub.verify_token'] === 'fb_weather_bot_verify_token') {
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
    if(event.message&&event.message.attachments){
      var attachment_failure="Sorry, I am still blind:( Hope my creator would give me eyes soon"
      sendMessage(sender,attachment_failure);
      res.sendStatus(200);
    }
    else if (event.message && event.message.text) {
      text = event.message.text;
      text = text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g,' ');
      last_query = text;
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
        		sendMessage(sender,response.output.text.toString());
        		res.sendStatus(200);
        	});
        }
      });
    } else if(event.postback && event.postback.payload) {
      console.log("Getting postback from webhook.");
      if (event.postback.payload == "relevant") {
        var relevance = 10;
        insertQnA(connection,last_answer,last_query,1,sender);
        sendMessage(sender,"Thanks for your feedback. I'm looking forward to see your again!");
      } else if (event.postback.payload == "irrelevant") {
        var relevance = 0;
        insertQnA(connection,last_answer,last_query,0,sender);
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

      var options = {
        url: 'https://gateway.watsonplatform.net/discovery/api/v1/environments/' + process.env.ENVIRONMENT_ID +'/collections/' + process.env.COLLECTION_ID + '/training_data?version=2017-09-01',
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
      event.postback.payload=null;
    }
  }
  // insertQnA(connection,last_answer,last_query,successFlag,sender);
});

function insertQnA(connection,lA,lQ,success,senderId){
	pool.getConnection(function(err, connection) {
		var query1='INSERT INTO answers (answer_content) SELECT "'+lA+'" FROM DUAL WHERE NOT EXISTS (SELECT * FROM answers WHERE answer_content="'+lA+'") LIMIT 1';
		connection.query('INSERT INTO answers (answer_content) SELECT "'+lA+'" FROM DUAL WHERE NOT EXISTS (SELECT * FROM answers WHERE answer_content="'+lA+'") LIMIT 1', function (error, results, fields) {
		if (error){console.log("answer: "+error.code+results[0].solution);
		console.log("query1: "+query1);
		}
		else{
			dbAnswerId=results.insertId;
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
		connection.release();
	  	});
	  	
};


function updateMessage(input, cv_response) {
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
  		  cv_response.output.text = response[0];
        last_answer = response[0];
        last_answer_id = response[1];
  		  resolve(cv_response);
        if(last_answer_id != 0) {
          sendFeedbackButton(sender);
        }
  		});
  	}else{
  		resolve(cv_response);
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
