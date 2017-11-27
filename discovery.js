const stringifyObject = require('stringify-object');
//var dateFormat = require('dateformat');
var queryNLP=require('./queryNLP');
var queryNLP_url=queryNLP.queryNLP_url;
var queryNLP_text=queryNLP.queryNLP_text;

function sendToDiscovery(query,type) {
  console.log("discovery_query: "+query);
  return new Promise(function(resolve, reject) {
    var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
    var discovery = new DiscoveryV1({
      username: process.env.DISCOVERY_USERNAME,
      password: process.env.DISCOVERY_PASSWORD,
      version_date: '2017-06-25'
    });
    var environment_id = process.env.ENVIRONMENT_ID;
    var collection_id = process.env.COLLECTION_ID;
    var news_collection_id = process.env.NEWS_COLLECTION_ID;
    var latest_news_collection_id = process.env.LATEST_NEWS_COLLECTION_ID;
    var trueQuery;

    // if(type=='title'){
    //   trueQuery="title:"+query; //only question natural language in title field
    // }
    trueQuery = query;
    var news_score = 0;
    var news_title;
    var news_url;
    var news_id;

    var qna_score = 0;
    var qna_title;
    var qna_text;
    var qna_id;
    //console.log("Before calling queryDiscovery.");
    var news_title_response = queryDiscovery(discovery, environment_id, news_collection_id, trueQuery, true);
    
    news_title_response.then(function(response) {
      //console.log("query news returned.");
      news_score = response.score;
      news_title = response.title;
      news_url = response.url;
      news_id = response.id;
      // var nlp_score=queryNLP(trueQuery,news_url);
      // if (news_score < 1) {
      //   news_desc_response = query(discovery, environment_id, news_collection_id, 'description:' + query)
      // }
      var qna_q_response = queryDiscovery(discovery, environment_id, collection_id, trueQuery, false);
      qna_q_response.then(function(response) {
        //console.log("query qna returned.");
        qna_score = response.score;
        console.log("score before: ",qna_score);
        qna_title = response.title;
        qna_text = response.text;
        qna_id = response.id;
        resolve(resolve_results(query, news_score, news_title, news_url, news_id, qna_score, qna_title, qna_text, qna_id));
        // var qna_nlp_score=queryNLP_text(trueQuery,qna_title);
        // qna_nlp_score.then(function(response){
        //   console.log(response[0]);
        //   qna_score +=response[0];
        //   resolve(resolve_results(query, news_score, news_title, news_url, news_id, qna_score, qna_title, qna_text, qna_id));
        // });
        
      });
    });
  });
}

function addDocument(json_obj) {
  var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
  var fs = require('file-system');
  var discovery = new DiscoveryV1({
    username: process.env.DISCOVERY_USERNAME,
    password: process.env.DISCOVERY_PASSWORD,
    version_date: '2017-10-16'
  });
  var document_obj = {
    environment_id: process.env.ENVIRONMENT_ID,
    collection_id: process.env.NEWS_COLLECTION_ID,
    file: json_obj
  };

  trueQuery = 'title:"' + json_obj.title + '",category::"' + json_obj.category + '"';
  var news_title_response = queryDiscovery(discovery, process.env.ENVIRONMENT_ID, process.env.NEWS_COLLECTION_ID, trueQuery, true);
  news_title_response.then(function(response) {
    console.log("query news returned.");
    news_score = response.score;
    news_pubDate = response.pubDate;
    //console.log("pubDate: " + news_pubDate);
    // news_title = response[1];
    // news_url = response[2];
    // news_id = response[3];
    if (news_score > 10) {
      console.log("Skipped addJsonDocument: " + json_obj.title);
    } else {
      console.log("New json found: " + json_obj.title + ", score = " + news_score);
      discovery.addJsonDocument(document_obj, function(error, data) {
        if (error) {
          console.error(error);
          return;
        }
        console.log(data);
      });
      
    }
  });
}

function getNews() {
  return new Promise(function(resolve, reject) {
    var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
    var discovery = new DiscoveryV1({
      username: process.env.DISCOVERY_USERNAME,
      password: process.env.DISCOVERY_PASSWORD,
      version_date: '2017-06-25'
    });
    var environment_id = process.env.ENVIRONMENT_ID;
    var news_collection_id = process.env.NEWS_COLLECTION_ID;

    news_arr = new Array(5);
    var local_response = getNewsOfCat(discovery, environment_id, news_collection_id, 'local');
    local_response.then(function(response) {
      news_arr[0] = response;
      var national_response = getNewsOfCat(discovery, environment_id, news_collection_id, 'national-world');
      national_response.then(function(response) {
        news_arr[1] = response;
        var sports_response = getNewsOfCat(discovery, environment_id, news_collection_id, 'sports');
        sports_response.then(function(response) {
          news_arr[2] = response;
          var ent_response = getNewsOfCat(discovery, environment_id, news_collection_id, 'entertainment');
          ent_response.then(function(response) {
            news_arr[3] = response;
            var life_response = getNewsOfCat(discovery, environment_id, news_collection_id, 'lifestyle');
            life_response.then(function(response) {
              news_arr[4] = response;
              resolve(news_arr);
            });
          });
        });
      });
    });
  });
}

function getNewsOfCat(discovery, environment_id, collection_id, category) {
  console.log("getNewsOfCat called with category: " + category);
  return new Promise(function(resolve, reject) {
    
    var now = new Date();
    var date_str = now.toGMTString().substring(0, 16);
    console.log("date_str: " + date_str);

    //news_arr = new Array(3);
    //var response_today = queryDiscoveryForThree(discovery, environment_id, news_collection_id, date_str);
    var trueQuery = 'pubDate:"' + date_str + '",category::"' + category + '"'; 
    var response_today = queryDiscovery(discovery, environment_id, collection_id, trueQuery, true);
    response_today.then(function(response) {
      if (response.score < 1.0) {
        now.setDate(now.getDate() - 1);
        date_str = now.toGMTString().substring(0, 16);
        var trueQuery = 'pubDate:"' + date_str + '",category::"' + category + '"'; 
        var response_yesterday = queryDiscovery(discovery, environment_id, collection_id, trueQuery, true);
        response_yesterday.then(function(response) {
          resolve(response);
        });
      } else {
        resolve(response);
      }
    });
    // response_today.then(function(response) {
    //   var i = 0;
    //   while (i < 3) {
    //     var score_today = response[i].score;
    //     if (score_today < 1.0) {
    //       break;
    //     } else {
    //       news_arr[i] = response[i];
    //       //news_arr[i] = response[i].title+": "+response[i].url;
    //       i++;
    //     }
    //   }
    //   var i_rep = i;
    //   if (i < 3) {
    //     now.setDate(now.getDate() - 1);
    //     var yesterday_date_str = now.toGMTString().substring(0, 16);
    //     var response_yesterday = queryDiscoveryForThree(discovery, environment_id, news_collection_id, yesterday_date_str);
    //     response_yesterday.then(function(response) {
    //       while (i < 3) {
    //         var score_yesterday = response[i - i_rep].score;
    //         if (score_yesterday < 1.0) {
    //           break;
    //         } else {
    //           news_arr[i] = response[i - i_rep];
    //           //news_arr[i] = response[i - i_rep].title+": "+ response[i - i_rep].url;
    //           i++;
    //         }
    //       }
    //       resolve(news_arr);
    //       //resolve(["Here are today's stories from StarNews: \n\n" + news_arr[0] + "\n\n" + news_arr[1] + "\n\n" + news_arr[2]]);
    //     });
    //   } else {
    //     resolve(news_arr);
    //     //resolve(["Here are today's stories from StarNews: \n\n" + news_arr[0] + "\n\n" + news_arr[1] + "\n\n" + news_arr[2]]);
    //   }      
    // });
    //var date_str = dateFormat(now.toGMTString());
  });
}


function queryDiscovery(discovery, environment_id, collection_id, trueQuery, is_news) {
  //trueQuery = trueQuery.replace(/:/g, ",");
  //trueQuery = trueQuery.replace(/(?<=\d),(?=\d)/g, "");
  //trueQuery = trueQuery.replace(/""/g, " ");
  console.log("trueQuery: " + trueQuery);
  return new Promise(function(resolve, reject) {
    discovery.query({
      environment_id: environment_id,
      collection_id: collection_id,
      query: trueQuery 
    }, function(error, data) {
      if (error) {
        resolve(makeDummyObj(is_news));
        //resolve([0, null, null, null, null]);
      } else {
        if (typeof data.results[0] == 'undefined') {
          console.log("Query returns no results.");
          // var score = 0;
          // var title = null;
          // var url_or_text = null;
          // var id = null;
          // var pubDate = null;
          resolve(makeDummyObj(is_news));
        } 
        else {
          // var score = data.results[0].score;
          // var title = data.results[0].title;
          // if (is_news) {
          //   var url_or_text = data.results[0].url;
          // } else {
          //   var url_or_text = data.results[0].text;
          // }
          // var id = data.results[0].id;
          // var pubDate = data.results[0].pubDate;
          console.log("Found results in news or spreadsheet: "+[data.results[0].title, data.results[0].text, data.results[0].score]);
          resolve(makeObj(data.results[0], is_news));
          //resolve(["This is what I found for you." + '\n' + data.results[0].title + '\n' + data.results[0].url, data.results[0].id]);
        }
        //resolve([score, title, url_or_text, id, pubDate]);
      }
    });   
  });
}

function queryDiscoveryForThree(discovery, environment_id, collection_id, trueQuery) {
  trueQuery = trueQuery.replace(/:/g, ",");
  //trueQuery = trueQuery.replace(/(?<=\d),(?=\d)/g, "");
  //trueQuery = trueQuery.replace(/""/g, " ");
  console.log("trueQuery: " + trueQuery);
  return new Promise(function(resolve, reject) {
    discovery.query({
      environment_id: environment_id,
      collection_id: collection_id,
      query: trueQuery // only querying the text field
    }, function(error, data) {
      if (error) {
        var obj_1 = makeDummyObj();
        var obj_2 = makeDummyObj();
        var obj_3 = makeDummyObj();
        resolve([obj_1, obj_2, obj_3]);
        //resolve([0, null, null, null, null]);
      } else {
        if (typeof data.results[0] == 'undefined') {
          console.log("Query returns no results.");
          // var score = 0;
          // var title = null;
          // var url_or_text = null;
          // var id = null;
          // var pubDate = null;
          var objs = new Array(3);
          var obj_1 = makeDummyObj(true);
          var obj_2 = makeDummyObj(true);
          var obj_3 = makeDummyObj(true);
          objs[0] = obj_1;
          objs[1] = obj_2;
          objs[2] = obj_3;
        } 
        else {
          // var score = data.results[0].score;
          // var title = data.results[0].title;
          // if (is_news) {
          //   var url_or_text = data.results[0].url;
          // } else {
          //   var url_or_text = data.results[0].text;
          // }
          // var id = data.results[0].id;
          // var pubDate = data.results[0].pubDate;
          var objs = new Array(3);
          for (var i=0; i<3;i++) {
            if (typeof data.results[i] == 'undefined') {
              objs[i] = makeDummyObj(true);
            }
            else {
              objs[i] = makeObj(data.results[i], true);
            }
          }
          
          // var obj_1 = makeObj(data.results[0]);
          // var obj_2 = makeDummyObj();
          // var obj_3 = makeDummyObj();
          //var obj_2 = makeObj(data.results[1]);
          //var obj_3 = makeObj(data.results[2]);
          console.log("Found results in news: "+[data.results[0].title, data.results[0].text, data.results[0].score]);
          //resolve(["This is what I found for you." + '\n' + data.results[0].title + '\n' + data.results[0].url, data.results[0].id]);
        }
        resolve(objs);
        //resolve([obj_1, obj_2, obj_3]);
      }
    });   
  });
}

function resolve_results(query, news_score, news_title, news_url, news_id, spreadsheet_score, spreadsheet_title, spreadsheet_text, spreadsheet_id) {
  console.log("news_score: "+news_score);
  console.log("spreadsheet_score: " + spreadsheet_score);
  if ((spreadsheet_score == 0 && news_score == 0)) {
    return(["Your call to Discovery was complete, but it didn't return a response. We will expand our database", 0, -1, null, null]);
  }
  else if (news_score < 0.5 && spreadsheet_score < 1.5) {
    var q=query.replace(/\s+/g, '+');
    var google = "I am so sorry my friend. I am not smart enough yet for that question. Here's the last thing I can do for you: https://www.google.com/search?q="+q;
    return([google, 0, -1, null, null]);
  }
  else if (news_score > 1.5) {
    return(["This is what I found for you.", news_id,1, news_title, news_url]);
  } 
  else if (spreadsheet_score > 3) {
    return([spreadsheet_title+'\n'+spreadsheet_text, spreadsheet_id, 0, null, null]);
  }
  
  // From now on, either news_score >= 0.5 or spreadsheet_score >= 1.0/
  else if (news_score > spreadsheet_score / 2) {
    return(["This is what I found for you.", news_id, 1, news_title, news_url]);
  } 
  else {
    return([spreadsheet_title+'\n'+spreadsheet_text, spreadsheet_id, 0, null, null]);
  }
}

var makeObj = function(result, is_news){
  var description = result.description || "NO SUBTITLE AVAILABLE";
  if (is_news == true) {
    res =  {
      "score": result.score,
      "title": result.title,
      "url": result.url,
      "pubDate": result.pubDate,
      "category": result.category,
      "description": description,
      "id": result.id
    };
  } else {
    res =  {
      "score": result.score,
      "title": result.title,
      "text": result.text,
      "id": result.id
    };
  }
  
  return res;
}

var makeDummyObj = function(is_news){
  if (is_news == true) {
    res = {
      "score": 0,
      "title": null,
      "url": null,
      "pubDate": null,
      "category": null,
      "description": null,
      "id": null
    };
  } else {
    res = {
      "score": 0,
      "title": null,
      "text": null,
      "id": null
    };
  }
  
  return res;
};

module.exports = {
  sendToDiscovery: sendToDiscovery,
  addDocument: addDocument,
  getNews: getNews
}
