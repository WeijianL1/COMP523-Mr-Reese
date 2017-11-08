const stringifyObject = require('stringify-object');
var request = require('request');

function getWeather() {
  console.log("getWeather called!");
  return new Promise(function(resolve, reject) {
    var options = {
      url: 'https://'+process.env.WEATHER_USERNAME +':' + process.env.WEATHER_PASSWORD + '@twcservice.mybluemix.net:443/api/weather/v1/location/28401:4:US/observations.json?units=m&language=en-US',
      method: 'GET',
    };

    function callback(error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log("weather 200 OK!");
        //console.log(body);
        body_obj = JSON.parse(body)
        var temp = body_obj.observation.temp;
        var weather = body_obj.observation.wx_phrase;
        resolve(['Currently at Wilmington it is ' + temp + " and " + weather + '.']);
      } else if (error){
        console.log("Weather Error: " + error);
        resolve([error]);
      } else {
        console.log("I am confused.");
        console.log(response.statusCode);
        resolve(["confused"]);
      }
    }
    request(options, callback);
  });
}

module.exports = getWeather;
