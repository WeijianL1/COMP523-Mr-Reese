var NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');
var stringSimilarity = require('string-similarity');
var similarity = require("similarity");
var natural_language_understanding = new NaturalLanguageUnderstandingV1({
    'username': process.env.NLP_USERNAME,
    'password': process.env.NLP_PASSWORD,
    'version_date': '2017-02-27'
});

function queryNLP_url(user_input, url) {
    console.log("NLP url called!");
    return new Promise(function(resolve, reject) {
            // var user_entities;
            // var user_keywords;
            // var url_entities;
            // var url_keywords;

            var user_payload = { //set json paylaod for user input
                'text': user_input,
                'features': {
                    'entities': {
                        'emotion': true,
                        'sentiment': true,
                        'limit': 5
                    },
                    'keywords': {
                        'emotion': true,
                        'sentiment': true,
                        'limit': 5
                    }
                }
            };
            var url_payload = { //set json payload for url
                'url': url,
                'features': {
                    'entities': {
                        'emotion': true,
                        'sentiment': true,
                        'limit': 5
                    },
                    'keywords': {
                        'emotion': true,
                        'sentiment': true,
                        'limit': 5
                    }
                }
            };

            natural_language_understanding.analyze(user_payload, function(err, response) {
                if (err) {
                    console.log('error:', err,"---user not analyzed");
                } else {
                    console.log("user analyzed");
                    var user_entities=response.entities;
                    var user_keywords=response.keywords;

                    natural_language_understanding.analyze(url_payload, function(err, response) {
                        if (err) {
                            console.log('error:', err, "---data not analyzed");
                        } else {
                            console.log("data analyzed");
                            var url_entities=response.entities;
                            var url_keywords=response.keywords;
                            //all data analyzed at this point
                            console.log(user_entities.length,url_entities.length);
                            var common_entity=[];
                            var score_offset=0;
                            user_entities.forEach(function(curr_user_entity,user_index){
                            	url_entities.forEach(function(curr_url_entity,url_index){
                            		if(curr_user_entity.type==curr_url_entity.type&&curr_user_entity.name==curr_url_entity.name){
                            			//find a match!
                            			common_entity.push([curr_user_entity,curr_url_entity]);
                            		}
                            	});
                            });

                            common_entity.forEach(function(curr_set){
                            	score_offset+=(curr_set[0].relevance+curr_set[1].relevance)/2;
                            });
                            resolve(score_offset);
                        }
                    });
                }
                resolve(0);
            });


        });
    };


    function queryNLP_text(user_input, title) {
        console.log("NLP text called!");
        return new Promise(function(resolve, reject) {
                // var user_entities;
                // var user_keywords;
                // var url_entities;
                // var url_keywords;

                var user_payload = { //set json paylaod for user input
                    'text': user_input,
                    'features': {
                        'entities': {
                            'emotion': true,
                            'sentiment': true,
                            'limit': 5
                        },
                        'keywords': {
                            'emotion': true,
                            'sentiment': true,
                            'limit': 5
                        },
                        'semantic_roles': {}
                    }
                };
                var title_payload = { //set json payload for url
                    'text': title,
                    'features': {
                        'entities': {
                            'emotion': true,
                            'sentiment': true,
                            'limit': 5
                        },
                        'keywords': {
                            'emotion': true,
                            'sentiment': true,
                            'limit': 5
                        },
                        'semantic_roles': {}
                    }
                };

                natural_language_understanding.analyze(user_payload, function(err, response) {
                    if (err) {
                        console.log('error:', err,"---user not analyzed");
                         resolve([0]);
                    } else {
                        console.log("user analyzed");
                        var user_entities=response.entities;
                        var user_keywords=response.keywords;
                        var user_semantic=response.semantic_roles;
                        natural_language_understanding.analyze(title_payload, function(err, response) {
                            if (err) {
                                console.log('error:', err, "---data not analyzed");
                                 resolve([0]);
                            } else {
                                console.log("data analyzed");
                                var title_entities=response.entities;
                                var title_keywords=response.keywords;
                                var title_semantic=response.semantic_roles;
                                //all data analyzed at this point
                                // console.log(user_entities.length,title_entities.length);

                                var score_offset=0;
                                user_semantic.forEach(function(curr_user_sem,user_index){
                                	// console.log("lengnth: ",curr_user_sem.length);
                                	title_semantic.forEach(function(curr_title_sem,title_index){
                                				var user_object=curr_user_sem.object.text;
                                				var user_verb=curr_user_sem.action.normalized;
                                				var title_object=curr_title_sem.object.text;
                                				var title_verb=curr_title_sem.action.normalized;
                                				score_offset-=similarity(user_object,title_verb)*1;
                                				console.log("sim ",user_object,"---",title_verb,"---",similarity(user_object,title_verb),"---",score_offset);
                                				score_offset-=similarity(user_verb,title_object)*1;
                                				console.log("sim ",user_verb,"---",title_object,"---",similarity(user_verb,title_object),"---",score_offset);
                                	});
                                });
                                console.log("final score_offset:",score_offset );
                                resolve([score_offset]);
                            }
                        });
                    }
                });
            });
        };

module.exports = {
  queryNLP_url: queryNLP_url,
  queryNLP_text: queryNLP_text
};