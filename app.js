//using squash branch
require('dotenv').config();
const stringifyObject = require('stringify-object');
// var Promise = require('promise');
var express = require('express');
var request = require('request');
var bodyParser = require('body-parser');
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var sendToDiscovery = require('./discovery');
var sendEntities = require('./sendEntities');
var generateEntityArray = require('./generateEntityArray.js');


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
  //from broker code
    messaging_events = req.body.entry[0].messaging;
    for (i = 0; i < messaging_events.length; i++) {
        event = req.body.entry[0].messaging[i];
        sender = event.sender.id;
        if (event.message && event.message.text) {
            text = event.message.text;
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
              	
                // var responseWords=data.output.text.toString();
                // var intent=data.intents[0].intent;
                // console.log("data: "+data+"---"+"intent: "+intent);
                // var intent='';
                // if(typeof data.intents[0]!='undefined'){  //has an intent
                // 	// console.log(typeof data.intents);
                // 	intent=data.intents[0].intent;
                // }
                
                // if(intent==''||intent=='off-topic'||responseWords==''){
                //   var query = updateMessage(text, data);  
                //   query.then(function(response){
                //     sendMessage(sender,response.output.text.toString());
                //   });
                //   res.sendStatus(200);
                // }else{
                //   context=data.context;
                //   console.log("responseWords: "+responseWords);
                //   sendMessage(sender,responseWords);
                //   res.sendStatus(200);
                //   }
              }
            });
        }
    }
});

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
  		   cv_response.output.text = response;
  		   resolve(cv_response);
  		});
  	}else{
  		resolve(cv_response);
  	}
  });
};

// This function receives the response text and sends it back to the user //
function sendMessage(sender,txt) {
    messageData = {
        text: txt
    }
      var numMsg=txt.length/600+1;
      for(var i=0;i<numMsg;i++){
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
                console.log('Error: ', response.body.error);
            }
        });
      }

    console.log("fbid: "+sender+"---"+"fb messageData: "+txt);

};

var token= process.env.FB_TOKEN;
var host = (process.env.VCAP_APP_HOST || 'localhost');
var port = (process.env.VCAP_APP_PORT || 3000);
app.listen(port, host);
