const stringifyObject = require('stringify-object');
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
      news_score = response[0];
      news_title = response[1];
      news_url = response[2];
      news_id = response[3];
      // if (news_score < 1) {
      //   news_desc_response = query(discovery, environment_id, news_collection_id, 'description:' + query)
      // }
      var qna_q_response = queryDiscovery(discovery, environment_id, collection_id, trueQuery, false);
      qna_q_response.then(function(response) {
        //console.log("query qna returned.");
        qna_score = response[0];
        qna_title = response[1];
        qna_text = response[2];
        qna_id = response[3];
        resolve(resolve_results(query, news_score, news_title, news_url, news_id, qna_score, qna_title, qna_text, qna_id));
      });
    });
  });
}

function queryDiscovery(discovery, environment_id, collection_id, trueQuery, is_news) {
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
        resolve([0, null, null, null, null]);
      } else {
        if (typeof data.results[0] == 'undefined') {
          console.log("Query returns no results.");
          var score = 0;
          var title = null;
          var url_or_text = null;
          var id = null;
          var pubDate = null;
        } 
        else {
          var score = data.results[0].score;
          var title = data.results[0].title;
          if (is_news) {
            var url_or_text = data.results[0].url;
          } else {
            var url_or_text = data.results[0].text;
          }
          var id = data.results[0].id;
          var pubDate = data.results[0].pubDate;
          console.log("Found results in news: "+[data.results[0].title, data.results[0].text, data.results[0].score]);
          //resolve(["This is what I found for you." + '\n' + data.results[0].title + '\n' + data.results[0].url, data.results[0].id]);
        }
        resolve([score, title, url_or_text, id, pubDate]);
      }
    });   
  });
}


function resolve_results(query, news_score, news_title, news_url, news_id, spreadsheet_score, spreadsheet_title, spreadsheet_text, spreadsheet_id) {
  console.log("news_score: "+news_score);
  console.log("spreadsheet_score: " + spreadsheet_score);
  if ((spreadsheet_score == 0 && news_score == 0)) {
    return(["Your call to Discovery was complete, but it didn't return a response. We will expand our database", 0, -1]);
  }
  else if (news_score < 0.5 && spreadsheet_score < 1.0) {
    var q=query.replace(/\s+/g, '+');
    var google = "I am so sorry my friend. I am not smart enough yet for that question. Here's the last thing I can do for you: https://www.google.com/search?q="+q;
    return([google, 0, -1]);
  }
  else if (news_score > 1.5) {
    return(["This is what I found for you." + '\n' + news_title + '\n' + news_url, news_id, 1]);
  } 
  else if (spreadsheet_score > 3) {
    return([spreadsheet_title+'\n'+spreadsheet_text, spreadsheet_id, 0]);
  }
  
  // From now on, either news_score >= 0.5 or spreadsheet_score >= 1.0/
  else if (news_score > spreadsheet_score / 2) {
    return(["This is what I found for you." + '\n' + news_title + '\n' + news_url, news_id, 1]);
  } 
  else {
    return([spreadsheet_title+'\n'+spreadsheet_text, spreadsheet_id, 0]);
  }
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

  trueQuery = json_obj.title;
  var news_title_response = queryDiscovery(discovery, process.env.ENVIRONMENT_ID, process.env.NEWS_COLLECTION_ID, trueQuery, true);
  news_title_response.then(function(response) {
    console.log("query news returned.");
    news_score = response[0];
    news_pubDate = response[4];
    console.log("pubDate: " + news_pubDate);
    // news_title = response[1];
    // news_url = response[2];
    // news_id = response[3];
    if (news_score > 2.5) {
      console.log("Skipped addJsonDocument: " + json_obj.title);
    } else {
      console.log("New json found: " + json_obj.title);
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
  console.log("getNews called.");
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
  });
}

module.exports = {
  sendToDiscovery: sendToDiscovery,
  addDocument: addDocument,
  getNews: getNews
}
