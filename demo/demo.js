var app = angular.module('FastMatchDemo', []);

app.controller('DemoController', function($scope, $http, $q) {

  $scope.wordCount = 0;

  var requests = [], words = [];
  angular.forEach('abcdefghijklmnopqrstuvwxyz'.split(''), function(chapter) {
    var request = $http.get('data/' + chapter + '.json');
    request.success(function(data) {
      words.push.apply(words, data);
      $scope.wordCount = words.length;
    });
    requests.push(request);
  });

  $q.all(requests).then(function() {
    $scope.loaded = true;

    $scope.matcher = new FastMatcher(words, {
      caseInsensitive: true,
      limit: 20,
      selector: 'term'
    });

    $scope.$watch('search', function() {
      if (!$scope.search) {
        $scope.matchingEntries = [];
        return;
      }

      $scope.matchingEntries = $scope.matcher.getMatches($scope.search);
    });
  });

});
