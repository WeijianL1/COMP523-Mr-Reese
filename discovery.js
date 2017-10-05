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
    var trueQuery;

    if(type=='title'){
      trueQuery="title:"+query; //only question natural language in title field
    }

    discovery.query({
      environment_id: environment_id,
      collection_id: collection_id,
      query: trueQuery // only querying the text field
    }, function(error, data) {
        if (error) {
          reject(error);
        } else {
          if (data.results == null) {
            console.log("Your call to Discovery was complete, but it didn't return a response. We will expand our database");
            reject(error);
          } else {
            // console.log("discovery_data: "+stringifyObject(data).replace("\n"," "));
            console.log("resolve: "+[data.results[0].title,data.results[0].text]);
            if(data.results[0].score<3){
              trueQuery='text:'+query;
              discovery.query({
                environment_id: environment_id,
                collection_id: collection_id,
                query: query // only querying the text field
              },function(errorText,dataText){
                if (errorText) {
                  reject(errorText);
                } else {
                  if(data.results == null) {
                    console.log("Your call to Discovery was complete, but it didn't return a response. We will expand our database");
                    reject(["Your call to Discovery was complete, but it didn't return a response. We will expand our database"]);
                  }
                  else if(dataText.results[0].score<1.5){
                    var q=query.replace(/\s+/g, '+');
                    var google="I am so sorry my friend. I am not smart enough yet for that question. Here's the last thing I can do for you: https://www.google.com/search?q="+q;
                    resolve([google]);
                  }
                  else{
                    resolve([data.results[0].title+'\n'+data.results[0].text]);
                  }
                }
              });
            }
            else{
            resolve([data.results[0].title+'\n'+data.results[0].text]);
            }
          }
        }
    });
  });
}


module.exports = sendToDiscovery;
