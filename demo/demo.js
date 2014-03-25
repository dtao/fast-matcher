var app = angular.module('FastMatchDemo', []);

app.controller('DemoController', function($scope, $http, $q) {

  var requests = [], words = [];
  angular.forEach('abcdefghijklmnopqrstuvwxyz'.split(''), function(chapter) {
    var request = $http.get('data/' + chapter + '.json');
    request.success(function(data) {
      words.push.apply(words, data);
    });
    requests.push(request);
  });

  $q.all(requests).then(function() {
    $scope.words = words;

    var matcher = new FastMatcher(words, { selector: 'term' });

    $scope.$watch('search', function() {
      $scope.matchingEntries = matcher.getMatches($scope.search);
    });
  });

});
