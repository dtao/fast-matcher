var fs         = require('fs'),
    wordnet    = require('wordnet'),
    async      = require('async'),
    dictionary = {};

function handleError(err) {
  if (err) {
    console.error(err);
    return process.exit(1);
  }
}

function createCallback(successHandler) {
  return function(err, result) {
    handleError(err);
    successHandler(result);
  };
}

function loadWordDefinition(word, callback) {
  var chapter = word.charAt(0),
      entries = dictionary[chapter] || (dictionary[chapter] = []),
      entry   = { term: word, definitions: [] }

  entries.push(entry);

  wordnet.lookup(word, createCallback(function(defs) {
    defs.forEach(function(def) {
      entry.definitions.push({ pos: def.meta.synsetType, def: def.glossary });
    });

    callback();
  }));
}

function writeChapter(chapter, callback) {
  var data = JSON.stringify(dictionary[chapter], null, 2);
  fs.writeFile('data/' + chapter + '.json', data, createCallback(function() {
    callback();
  }));
}

console.log('Loading word list...');
wordnet.list(createCallback(function(list) {
  console.log('Loaded word list. Loading definitions...');
  async.each(list, loadWordDefinition, function(err) {
    handleError(err);
    console.log('Loaded definitions. Writing data files...');
    async.each(Object.keys(dictionary), writeChapter, function(err) {
      handleError(err);
      console.log('Finished!');
    });
  });
}));
