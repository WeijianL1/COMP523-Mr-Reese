const stringifyObject = require('stringify-object');
//var dateFormat = require('dateformat');
var request = require('request');
var queryNLP=require('./queryNLP');
var queryNLP_url=queryNLP.queryNLP_url;
var queryNLP_text=queryNLP.queryNLP_text;
var rssParser = require('rss-parser');
var cheerio = require('cheerio');//for scrapper

var url_dict_arr = [
  {
    category: "local",
    url: 'http://www.starnewsonline.com/news/local?template=rss&mime=xml'
  },
  {
    category: "national-world",
    url: 'http://www.starnewsonline.com/news/nation-world?template=rss&mime=xml'
  }, {
    category: "sports",
    url: 'http://www.starnewsonline.com/sports?template=rss&mime=xml'
  },
  {
    category: "entertainment",
    url: 'http://www.starnewsonline.com/entertainment?template=rss&mime=xml'
  }, {
    category: "lifestyle",
    url: 'http://www.starnewsonline.com/lifestyle?template=rss&mime=xml'
  }
];

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

function addDocument(json_obj) {
  console.log("hit addDocument");
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
  //trueQuery = trueQuery.replace(/""/g, " ");
  trueQuery = 'title:"' + json_obj.title.replace(/"/g, "'") + '",category::"' + json_obj.category + '"';
  var news_title_response = _queryDiscovery(discovery, process.env.ENVIRONMENT_ID, process.env.NEWS_COLLECTION_ID, trueQuery, "Star News");
  news_title_response.then(function(response) {
    console.log("query news returned.");
    news_score = response.score;
    news_pubDate = response.pubDate;
    news_url = response.url;
    news_id = response.id;

    // Delete the previous article from discovery.
    if (news_score > 15) {
      console.log("Found similar news." + json_obj.title);
      if (news_url != json_obj.url) {
        console.log("Found outdated url. Delete old news and add new one.");
        discovery.deleteDocument(
          {environment_id: process.env.ENVIRONMENT_ID, collection_id: process.env.NEWS_COLLECTION_ID, document_id: news_id}, 
          function(error, data) {
            console.log("JSON.stringify(data, null, 2)");
            console.log("Can't delete news from discovery.")
          }
        );
        console.log("Adding news_obj with updated url: " + json_obj.title + ", score = " + news_score);
        discovery.addJsonDocument(document_obj, function(error, data) {
          if (error) {
            console.error(error);
            return;
          }
          console.log(data);
        });
      } 
    } else {
      console.log("Adding new json: " + json_obj.title + ", score = " + news_score);
      discovery.addJsonDocument(document_obj, function(error, data) {
        if (error) {
          console.error(error);
          return;
        }
        console.log(data);
      });
    }
    
  });
};

function sendToDiscovery(query, type, ret_mult_temp) {
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
    // var latest_news_collection_id = process.env.LATEST_NEWS_COLLECTION_ID;
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

    if (ret_mult_temp == true) {  // return three responses to user.
      var news_response = _queryDiscoveryForThree(discovery, environment_id, news_collection_id, trueQuery);
      news_response.then(function(response) {
        resolve(_resolve_results(query, response))
      });
    } else {
      var news_title_response = _queryDiscovery(discovery, environment_id, news_collection_id, trueQuery, "Star News");
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
        var qna_q_response = _queryDiscovery(discovery, environment_id, collection_id, trueQuery, "Spreadsheet");
        qna_q_response.then(function(response) {
        //console.log("query qna returned.");
        qna_score = response.score;
        console.log("score before: ",qna_score);
        qna_title = response.title;
        qna_text = response.text;
        qna_id = response.id;
        resolve(_compare_results(query, news_score, news_title, news_url, news_id, qna_score, qna_title, qna_text, qna_id));
        // var qna_nlp_score=queryNLP_text(trueQuery,qna_title);
        // qna_nlp_score.then(function(response){
        //   console.log(response[0]);
        //   qna_score +=response[0];
        //   console.log("score after: ",qna_score);
        //   resolve(_resolve_results(query, news_score, news_title, news_url, news_id, qna_score, qna_title, qna_text, qna_id));
        // });
        
        });
      });
    }

  });
};

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
    var local_response = _getNewsOfCat(discovery, environment_id, news_collection_id, 'local');
    local_response.then(function(response) {
      news_arr[0] = response;
      var national_response = _getNewsOfCat(discovery, environment_id, news_collection_id, 'national-world');
      national_response.then(function(response) {
        news_arr[1] = response;
        var sports_response = _getNewsOfCat(discovery, environment_id, news_collection_id, 'sports');
        sports_response.then(function(response) {
          news_arr[2] = response;
          var ent_response = _getNewsOfCat(discovery, environment_id, news_collection_id, 'entertainment');
          ent_response.then(function(response) {
            news_arr[3] = response;
            var life_response = _getNewsOfCat(discovery, environment_id, news_collection_id, 'lifestyle');
            life_response.then(function(response) {
              news_arr[4] = response;
              resolve(news_arr);
            });
          });
        });
      });
    });
  });
};

function _getNewsOfCat(discovery, environment_id, collection_id, category) {
  console.log("getNewsOfCat called with category: " + category);
  return new Promise(function(resolve, reject) {
    var now = new Date();
    var day_off=1;
    var date_str = now.toGMTString().substring(0, 16);
    console.log("date_str: " + date_str);
    //news_arr = new Array(3);
    //var response_today = _queryDiscoveryForThree(discovery, environment_id, news_collection_id, date_str);
    var trueQuery = 'pubDate:"' + date_str + '",category::"' + category + '"'; 
    var response_today = _queryDiscovery(discovery, environment_id, collection_id, trueQuery, "Star News");
    response_today.then(function(response) {
      if (response.score < 1.0) {
        now.setDate(now.getDate() - day_off);
        date_str = now.toGMTString().substring(0, 16);
        var trueQuery = 'pubDate:"' + date_str + '",category::"' + category + '"'; 
        var response_yesterday = _queryDiscovery(discovery, environment_id, collection_id, trueQuery, "Star News");
        response_yesterday.then(function(response) {
          resolve(response);
        });
      } else {
        resolve(response);
      }
    });
  });
};

function _queryDiscovery(discovery, environment_id, collection_id, query, source) {
  //trueQuery = trueQuery.replace(/:/g, ",");
  //trueQuery = trueQuery.replace(/(?<=\d),(?=\d)/g, "");
  //trueQuery = trueQuery.replace(/""/g, " ");
  trueQuery = query.replace(/"/g, "'");
  console.log("trueQuery: " + trueQuery);
  return new Promise(function(resolve, reject) {
    discovery.query({
      environment_id: environment_id,
      collection_id: collection_id,
      query: trueQuery 
    }, function(error, data) {
      if (error) {
      resolve(_makeDummyObj(source));
      //resolve([0, null, null, null, null]);
      } else {
      if (typeof data.results[0] == 'undefined') {
        console.log("Query returns no results.");
        // var score = 0;
        // var title = null;
        // var url_or_text = null;
        // var id = null;
        // var pubDate = null;
        resolve(_makeDummyObj(source));
      } 
      else {
        // var score = data.results[0].score;
        // var title = data.results[0].title;
        // if (source) {
        //   var url_or_text = data.results[0].url;
        // } else {
        //   var url_or_text = data.results[0].text;
        // }
        // var id = data.results[0].id;
        // var pubDate = data.results[0].pubDate;
        console.log("Found results in news or spreadsheet: "+[data.results[0].title, data.results[0].text, data.results[0].score]);
        resolve(_makeObj(data.results[0], source));
        //resolve(["This is what I found for you." + '\n' + data.results[0].title + '\n' + data.results[0].url, data.results[0].id]);
      }
      //resolve([score, title, url_or_text, id, pubDate]);
      }
    });   
  });
};

function _resolve_results(query, news_list) {
  var ret_list = [];
  //news_list.forEach(function(element) {
  for (idx = 0; idx < news_list.length; idx ++) {
    element = news_list[idx]
    if (element.score < 5) {
      if (idx == 0) {
        var q=query.replace(/\s+/g, '+');
        var google = "I am so sorry my friend. I am not smart enough yet for that question. Here's the last thing I can do for you: https://www.google.com/search?q="+q;
        var google_payload={
          answer_txt: google ,
          id: 0,
          source: "Google",
          title: null,
          url: null,
          score: 0
        };
        return([google_payload]);
      } else {
        break;
      }
    } else {
      var news_payload = {
        answer_txt: "Here are the answers I found for you.",
        id: element.id,
        source: "Star News",
        title: element.title,
        url: element.url,
        score: element.score
      };
      ret_list.push(news_payload)
    }
  }
  return ret_list;
}

function _compare_results(query, news_score, news_title, news_url, news_id, spreadsheet_score, spreadsheet_title, spreadsheet_text, spreadsheet_id) {
  console.log("news_score: "+news_score);
  console.log("spreadsheet_score: " + spreadsheet_score);
  var news_payload={
    answer_txt:   "This is what I found for you.",
    id:   news_id,
    source:   "Star News",
    title:  news_title,
    url:  news_url,
    score: news_score
  };
  var spreadsheet_payload={
    answer_txt: spreadsheet_text,
    id:   spreadsheet_id,
    source:   "Spreadsheet",
    title:  null,
    url:  null,
    score: spreadsheet_score
  };

  var fail_payload={
    answer_txt:  "Your call to Discovery was complete, but it didn't return a response. We will expand our database" ,
    id:   0,
    source:   "Fail",
    title:  null,
    url:  null,
    score: 0
  };

  if ((spreadsheet_score == 0 && news_score == 0)) {
    return(fail_payload);
  }
  else if (news_score < 5 && spreadsheet_score < 5) {
    var q=query.replace(/\s+/g, '+');
    var google = "I am so sorry my friend. I am not smart enough yet for that question. Here's the last thing I can do for you: https://www.google.com/search?q="+q;
    var google_payload={
      answer_txt:  google ,
      id:   0,
      source:   "Google",
      title:  null,
      url:  null,
      score:0
    };
    return(google_payload);
  }
  else if (news_score > 19) {
    return(news_payload);
  } 
  else if (spreadsheet_score > 20) {
    return(spreadsheet_payload);
  }
  // From now on, either news_score >= 0.5 or spreadsheet_score >= 1.0/
  else if (news_score > spreadsheet_score / 2) {
    return(news_payload);
  } 
  else {
    return(spreadsheet_payload);
  }
};

var _makeObj = function(result, source){
  var description = result.description || "NO SUBTITLE AVAILABLE";
  if (source == "Star News") {
    res =  {
      "score": result.score,
      "title": result.title,
      "url": result.url,
      "pubDate": result.pubDate,
      "category": result.category,
      "description": description,
      "id": result.id
    };
  } else if(source=="Spreadsheet") {
    res =  {
      "score": result.score,
      "title": result.title,
      "text": result.text,
      "id": result.id
    };
  } else if(source=="Watson"){
    res =  {
      "score": result.score,
      "title": result.title,
      "url": result.url,
      "pubDate": result.publication_date,
      "description": "",
      "id": result.id,
      "image_url": result.main_image_url
    };
  }
  
  return res;
};

var _makeDummyObj = function(source){
  if (source == "Star News") {
    res = {
      "score": 0,
      "title": null,
      "url": null,
      "pubDate": null,
      "category": null,
      "description": null,
      "id": null
    };
  } else if(source=="Spreadsheet"){
    res = {
      "score": 0,
      "title": null,
      "text": null,
      "id": null
    };
  } else {
    console.log("Unexpected sourse in _makeDummyObj.");
    return null;
  }
  return res;
};

function _queryDiscoveryForThree(discovery, environment_id, collection_id, trueQuery) {//deprecated
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
        var obj_1 = _makeDummyObj("Star News");
        var obj_2 = _makeDummyObj("Star News");
        var obj_3 = _makeDummyObj("Star News");
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
        var obj_1 = _makeDummyObj("Star News");
        var obj_2 = _makeDummyObj("Star News");
        var obj_3 = _makeDummyObj("Star News");
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
            objs[i] = _makeDummyObj("Star News");
          }
          else {
            objs[i] = _makeObj(data.results[i], "Star News");
          }
        }
        // var obj_1 = _makeObj(data.results[0]);
        // var obj_2 = _makeDummyObj();
        // var obj_3 = _makeDummyObj();
        //var obj_2 = _makeObj(data.results[1]);
        //var obj_3 = _makeObj(data.results[2]);
        console.log("Found results in news: "+[data.results[0].title, data.results[0].text, data.results[0].score]);
        //resolve(["This is what I found for you." + '\n' + data.results[0].title + '\n' + data.results[0].url, data.results[0].id]);
      }
        resolve(objs);
      }
    });   
  });
};

// function getWatsonNews(){
//   return new Promise(function(resolve, reject) {
//     var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');
//     var discovery = new DiscoveryV1({
//       username: process.env.DISCOVERY_USERNAME,
//       password: process.env.DISCOVERY_PASSWORD,
//       version_date: '2017-06-25'
//     });
//     var environment_id = process.env.WATSON_ENVIRONMENT_ID;
//     var news_collection_id = process.env.WATSON_COLLECTION_ID;

//     news_arr = new Array(5);
//     var now = new Date();
//     now=now.toISOString().split('T')[0];//make a date in format: 11-30-2017
//     var trueQuery = 'publication_date:"' + now; 
//     var response_today = _queryDiscovery(discovery, environment_id, collection_id, trueQuery, "Star News");
//     response_today.then(function(response) {
//     });
//   });
// }

module.exports = {
  updateNewsWithRSS: updateNewsWithRSS,
  sendToDiscovery: sendToDiscovery,
  addDocument: addDocument,
  getNews: getNews
}
