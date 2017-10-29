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
    var trueQuery;

    if(type=='title'){
      trueQuery="title:"+query; //only question natural language in title field
    }

    discovery.query({
      environment_id: environment_id,
      collection_id: news_collection_id,
      query: trueQuery // only querying the text field
    }, function(error, data) {
      if (error) {
        resolve([error]);
      } else {
        if (typeof data.results[0] == 'undefined' || data.results[0].score < 1.5) {
          discovery.query({
            environment_id: environment_id,
            collection_id: collection_id,
            query: trueQuery // only querying the text field
          }, function(error, data) {
            if (error) {
              resolve([error]);
            } else {
              if (typeof data.results[0] == 'undefined') {
                console.log("Query Title, no results");
                resolve(["Your call to Discovery was complete, but it didn't return a response. We will expand our database"]);
              } else {
                // console.log("discovery_data: "+stringifyObject(data).replace("\n"," "));
                console.log("resolve in spreadsheet: "+[data.results[0].title,data.results[0].text]);
                if(data.results[0].score<1.5){
                  trueQuery='text:'+query;
                  discovery.query({
                    environment_id: environment_id,
                    collection_id: collection_id,
                    query: query // only querying the text field
                  },function(errorText,dataText){
                    if (errorText) {
                      resolve([errorText]);
                    } else {
                      if(typeof data.results[0] == 'undefined') {
                        console.log("Query Text, no results.");
                        resolve(["Your call to Discovery was complete, but it didn't return a response. We will expand our database", 0]);
                      }
                      else if(dataText.results[0].score<1.5){
                        var q=query.replace(/\s+/g, '+');
                        var google="I am so sorry my friend. I am not smart enough yet for that question. Here's the last thing I can do for you: https://www.google.com/search?q="+q;
                        resolve([google, 0]);
                      }
                      else{
                        resolve([data.results[0].title+'\n'+data.results[0].text, data.results[0].id]);
                      }
                    }
                  });
                }
                else{
                  resolve([data.results[0].title+'\n'+data.results[0].text, data.results[0].id]);
                }
              }
            }
          });
        
        } 
        else {
          // console.log("discovery_data: "+stringifyObject(data).replace("\n"," "));
          console.log("resolve in news: "+[data.results[0].title,data.results[0].text]);
          resolve(["This is what I found for you." + '\n' + data.results[0].title + '\n' + data.results[0].url, data.results[0].id]);
        }
      }
    });
  });
}

module.exports = sendToDiscovery;
