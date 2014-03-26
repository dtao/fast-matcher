(function() {

  /**
   * @example
   * var list = ['b', 'a', 'c'];
   *
   * // constructing a FastMatcher instance should not modify the list passed in
   * new FastMatcher(list); // list == ['b', 'a', 'c']
   */
  function FastMatcher(list, options) {
    var source    = this.source = this.wrapList(list);
    this.options  = options || {};
    this.matches  = this.options.matches || [];

    var selectors = this.selectors = this.createSelectors();
    this.lists = selectors.map(function(selector) {
      var list = source.slice(0);
      list.sort(function(x, y) {
        return compare(selector(x.val), selector(y.val));
      });
      list.selector = selector;
      return list;
    });
  }

  /**
   * @example
   * function wrapList(list) {
   *   return new FastMatcher([]).wrapList(list);
   * }
   *
   * wrapList([5, 3, 4]); // => [{i:0,val:5},{i:1,val:3},{i:2,val:4}]
   */
  FastMatcher.prototype.wrapList = function wrapList(list) {
    return list.map(function(e, i) { return { i: i, val: e }; });
  };

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
   */
  FastMatcher.prototype.getMatches = function getMatches(prefix) {
    if (this.options.caseInsensitive) {
      prefix = prefix.toLowerCase();
    }

    var limit = Number(this.options.limit || 25),
        lists = this.lists,
        items = [],
        list, index, item, itemsAdded;

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

        item = list.selector(list[index].val);
        if (this.options.caseInsensitive) {
          item = item.toLowerCase();
        }

        if (!startsWith(item, prefix)) {
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

    populate(this.matches, getValues(items));

    return this.matches;
  };

  FastMatcher.prototype.findIndex = function findIndex(list, prefix) {
    var selector = list.selector,
        lower    = 0,
        upper    = list.length;

    var i, value;
    while (lower < upper) {
      i = (lower + upper) >>> 1;

      value = selector(list[i].val);
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
   * getValues([{i:0,val:'a'},{i:0,val:'a'},{i:1,val:'b'}]);
   * // => ['a', 'b']
   */
  function getValues(items) {
    var indexes = {}, values = [];
    items.forEach(function(item) {
      if (!indexes[item.i]) {
        indexes[item.i] = true;
        values.push(item.val);
      }
    });
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
