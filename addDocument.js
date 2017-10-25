const stringifyObject = require('stringify-object');

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
	discovery.addJsonDocument(document_obj, function(error, data) {
		if (error) {
			console.error(error);
			return;
		}
		console.log(data);
	});
	// for (id = 0, id < 20, id ++) {
	// 	var file = fs.readFileSync('/home/vcap/app/news_' + id + '.json');
	// 	console.log("readfile success!");

	// 	discovery.addDocument((process.env.ENVIRONMENT_ID, process.env.NEWS_COLLECTION_ID, file, null, "2017-10-16"),
	// 	function(error, data) {
	// 	  console.log("addDocument error: " + JSON.stringify(data, null, 2));
	// 	});
	// }

	//var file = fs.readFileSync('/home/vcap/app/news_0.json');
	// var file = fs.createReadStream('/home/vcap/app/news_0.json');
	// console.log("readfile success!");

	// discovery.addDocument((process.env.ENVIRONMENT_ID, process.env.NEWS_COLLECTION_ID, file, null, "2017-10-16"),
	// function(error, data) {
	//   console.log("addDocument error: " + JSON.stringify(data, null, 2));
	// });
	
}

module.exports = addDocument;
