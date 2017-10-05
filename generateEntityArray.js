function generateEntityArray(conversationResponse) {
  return new Promise(function(resolve,reject) {
    console.log("start of generateEntityArray");
    var entities = conversationResponse.entities;
    var queryLanguage = 'enriched_title.entities.text:';
    var entityQuery = '';

    for (var i = 0; i < entities.length; i++) {
        entityQuery = entityQuery.concat(queryLanguage + entities[i].value);
        if (i < (entities.length - 1)) {
          entityQuery = entityQuery.concat('|')
        }
    };
    resolve(entityQuery);
  });
  // console.log("entityQuery:"+entityQuery);
  // return entityQuery;
}

module.exports = generateEntityArray;
