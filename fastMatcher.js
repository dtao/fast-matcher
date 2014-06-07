(function() {

  /**
   * @example
   * var list = ['b', 'a', 'c'];
   *
   * // constructing a FastMatcher instance should not modify the list passed in
   * new FastMatcher(list); // list == ['b', 'a', 'c']
   */
  function FastMatcher(list, options) {
    this.source    = list.slice(0);
    this.options   = options || {};
    this.matches   = this.options.matches || [];
    this.selectors = this.createSelectors();

    var source = this.source,
        options = this.options,
        lists = [];

    this.selectors.forEach(function(selector) {
      var maxSegments = 0;

      var list = source.map(function(e, i) {
        var item = {
          i: i,
          val: e,
          selectedVal: selector(e)
        };

        if (options.anyWord) {
          item.segments = getSubstrings(item.selectedVal);
          maxSegments = Math.max(maxSegments, item.segments.length);
        }

        return item;
      });

      if (options.anyWord) {
        for (var i = 0; i < maxSegments; ++i) {
          lists.push(
            list
              .filter(function(item) {
                return i < item.segments.length;
              })
              .map(function(item) {
                return {
                  i: item.i,
                  val: item.val,
                  selectedVal: item.segments[i]
                };
              })
              .sort(function(x, y) {
                return compare(x.selectedVal, y.selectedVal);
              }));
        }

      } else {
        list.sort(function(x, y) {
          return compare(x.selectedVal, y.selectedVal);
        });

        lists.push(list);
      }
    });

    this.lists = lists;
  }

  /**
   * @example
   * function createSelectors(selector) {
   *   return new FastMatcher([], { selector: selector }).createSelectors();
   * }
   *
   * createSelectors()[0]('foo');
   * // => 'foo'
   *
   * createSelectors('x')[0]({ x: 'bar'});
   * // => 'bar'
   *
   * createSelectors(function(str) { return str.slice(1); })[0]('foo');
   * // => 'oo'
   *
   * createSelectors(['x', 'y'])[0]({ x: 'foo', y: 'bar' });
   * // => 'foo'
   *
   * createSelectors(['x', 'y'])[1]({ x: 'foo', y: 'bar' });
   * // => 'bar'
   */
  FastMatcher.prototype.createSelectors = function createSelectors() {
    var options   = this.options,
        selectors = options.selector;

    if (!(selectors instanceof Array)) {
      selectors = [selectors];
    }

    return selectors.map(function(selector) {
      var baseSelector = getBaseSelector(selector);

      return options.caseInsensitive ?
        function(x) { return baseSelector(x).toLowerCase(); } :
        baseSelector;
    });
  };

  /**
   * @example
   * function getMatches(list, prefix, options) {
   *   return new FastMatcher(list, options).getMatches(prefix);
   * }
   *
   * getMatches(['aa', 'ab', 'ba', 'bb'], 'a');
   * // => ['aa', 'ab']
   *
   * getMatches(['aa', 'ba', 'AB', 'BB'], 'a', { caseInsensitive: true });
   * // => ['aa', 'AB']
   *
   * getMatches(['ac', 'ab', 'b', 'aa'], 'a', { preserveOrder: true });
   * // => ['ac', 'ab', 'aa']
   *
   * getMatches(['aa', 'ab', 'ac'], 'a', { limit: 2 });
   * // => ['aa', 'ab']
   *
   * getMatches([{x:'a',y:'b'},{x:'b',y:'a'}], 'a', { selector: ['x', 'y'] });
   * // => [{x:'a',y:'b'},{x:'b',y:'a'}]
   *
   * getMatches([{x:'a'},{y:'a'}], 'a', { selector: ['x', 'y'] });
   * // => [{x:'a'},{y:'a'}]
   *
   * getMatches([{x:'a',y:'a'}], 'a', { selector: ['x', 'y'] });
   * // => [{x:'a',y:'a'}]
   *
   * getMatches([{x:'a',y:'a'},{x:'a',y:'b'},{x:'b',y:'a'}], 'a', { selector: ['x', 'y'], limit: 3 });
   * // => [{x:'a',y:'a'},{x:'a',y:'b'},{x:'b',y:'a'}]
   *
   * getMatches([{x:'a',y:'a'},{x:'a',y:'b'},{x:'b',y:'a'},{x:'c',y:'a'}], 'a', { selector: ['x', 'y'], limit: 3 });
   * // => [{x:'a',y:'a'},{x:'a',y:'b'},{x:'b',y:'a'}]
   *
   * getMatches(['a', 'a b', 'a c', 'b', 'c a b'], 'b', { anyWord: true });
   * // => ['b', 'a b', 'c a b']
   *
   * getMatches(['a', 'a b', 'a c', 'b', 'c a b'], 'b', { anyWord: true, preserveOrder: true });
   * // => ['a b', 'b', 'c a b']
   *
   * getMatches(['a', 'a b', 'c a b'], 'a b', { anyWord: true });
   * // => ['a b', 'c a b']
   */
  FastMatcher.prototype.getMatches = function getMatches(prefix) {
    if (this.options.caseInsensitive) {
      prefix = prefix.toLowerCase();
    }

    var originalLimit = Number(this.options.limit || 25);

    var limit = originalLimit,
        lists = this.lists,
        items = [],
        list, index, value, itemsAdded;

    for (var i = 0; i < lists.length; ++i) {
      if (items.length === limit) {
        break;
      }

      list = lists[i];
      index = this.findIndex(list, prefix);
      itemsAdded = 0;

      while (index < list.length) {
        if (items.length === limit) {
          break;
        }

        value = list[index].selectedVal;
        if (this.options.caseInsensitive) {
          value = value.toLowerCase();
        }

        if (!startsWith(value, prefix)) {
          break;
        }

        items.push(list[index++]);
        ++itemsAdded;
      }

      // Say the original limit is 20 and we just found 10 more items. We now
      // need to increase the effective limit (before removing duplicates) by 10
      // to account for the maximum possible overlap between the matches found
      // so far and the matches from the next list.
      limit += itemsAdded;
    }

    if (this.options.preserveOrder) {
      items.sort(function(x, y) { return compare(x.i, y.i); });
    }

    populate(this.matches, getValues(items, originalLimit));

    return this.matches;
  };

  FastMatcher.prototype.findIndex = function findIndex(list, prefix) {
    var lower    = 0,
        upper    = list.length;

    var i, value;
    while (lower < upper) {
      i = (lower + upper) >>> 1;

      value = list[i].selectedVal;
      if (this.options.caseInsensitive) {
        value = value.toLowerCase();
      }

      if (compare(value, prefix) === -1) {
        lower = i + 1;
      } else {
        upper = i;
      }
    }

    return lower;
  };

  /**
   * @private
   * @example
   * getBaseSelector()('foo');
   * // => 'foo'
   *
   * getBaseSelector('x')({ x: 'bar'});
   * // => 'bar'
   *
   * getBaseSelector(function(str) { return str.slice(1); })('foo');
   * // => 'oo'
   */
  function getBaseSelector(selector) {
    if (typeof selector === 'function') {
      return selector;
    }

    if (selector) {
      return function(x) { return x[selector] || ''; };
    }

    return function(x) { return x; };
  }

  /**
   * @private
   * @example
   * getSubstrings('of the night');
   * // => ['of the night', 'the night', 'night']
   *
   * getSubstrings(' foo bar ');
   * // => ['foo bar ', 'bar ']
   */
  function getSubstrings(string) {
    string = string.replace(/^\s+/, '');

    var substrings = [string],
        startOfWord = /\s[^\s]/g,
        match;

    while (match = startOfWord.exec(string)) {
      substrings.push(string.substring(match.index + 1));
    }

    return substrings;
  }

  /**
   * @private
   * @example
   * var arr = [];
   *
   * populate(arr, [1, 2, 3]); // arr == [1, 2, 3]
   * populate(arr, []);        // arr == []
   * populate(arr, ['foo']);   // arr == ['foo']
   */
  function populate(array, elements) {
    var count = elements.length;
    array.length = count;
    for (var i = 0; i < count; ++i) {
      array[i] = elements[i];
    }
  }

  /**
   * @private
   * @example
   * getValues([{i:0,val:'a'},{i:0,val:'a'},{i:1,val:'b'}], 3);
   * // => ['a', 'b']
   *
   * getValues([{i:0,val:'a'},{i:1,val:'b'},{i:2,val:'c'}], 2);
   * // => ['a', 'b']
   */
  function getValues(items, limit) {
    var indexes = {}, values = [];

    for (var i = 0; values.length < limit && i < items.length; ++i) {
      if (!indexes[items[i].i]) {
        indexes[items[i].i] = true;
        values.push(items[i].val);
      }
    }

    return values;
  }

  /**
   * @private
   * @example
   * compare('foo', 'foo'); // => 0
   * compare('foo', 'bar'); // => 1
   * compare('bar', 'foo'); // => -1
   */
  function compare(x, y) {
    if (x == y) { return 0; }
    return x > y ? 1 : -1;
  }

  /**
   * @private
   * @example
   * startsWith('', 'a');     // => false
   * startsWith('a', 'a');    // => true
   * startsWith('aa', 'a');   // => true
   * startsWith('foo', 'f');  // => true
   * startsWith('bar', 'f');  // => false
   * startsWith('foo', 'fo'); // => true
   * startsWith('foo', 'o');  // => false
   */
  function startsWith(string, prefix) {
    return string.lastIndexOf(prefix, prefix.length - 1) === 0;
  }

  if (typeof module === 'object' && (module && module.exports)) {
    module.exports = FastMatcher;
  }

  this.FastMatcher = FastMatcher;

}.call(this));
