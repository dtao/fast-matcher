(function() {

  /**
   * @example
   * var list = ['b', 'a', 'c'];
   *
   * // constructing a FastMatcher instance should not modify the list passed in
   * new FastMatcher(list); // list == ['b', 'a', 'c']
   */
  function FastMatcher(list, options) {
    this.list     = this.wrapList(list);
    this.options  = options || {};
    this.matches  = this.options.matches || [];

    var selector = this.selector = this.createSelector();
    this.list.sort(function(x, y) {
      return compare(selector(x.val), selector(y.val));
    });
  }

  /**
   * @example
   * function wrapList(list) {
   *   return new FastMatcher(list).list;
   * }
   *
   * wrapList([5, 3, 4]); // => [{i:1,val:3},{i:2,val:4},{i:0,val:5}]
   */
  FastMatcher.prototype.wrapList = function wrapList(list) {
    return list.map(function(e, i) { return { i: i, val: e }; });
  };

  /**
   * @example
   * function createSelector(property) {
   *   return new FastMatcher([], { selector: property }).createSelector();
   * }
   *
   * createSelector()('foo');
   * // => 'foo'
   *
   * createSelector('x')({ x: 'bar'});
   * // => 'bar'
   *
   * createSelector(function(str) { return str.slice(1); })('foo');
   * // => 'oo'
   */
  FastMatcher.prototype.createSelector = function createSelector() {
    var baseSelector = this.getBaseSelector(this.options.selector);

    return this.options.caseInsensitive ?
      function(x) { return baseSelector(x).toLowerCase(); } :
      baseSelector;
  };

  FastMatcher.prototype.getBaseSelector = function(selector) {
    if (typeof selector === 'function') {
      return selector;
    }

    if (selector) {
      return function(x) { return x[selector]; };
    }

    return function(x) { return x; };
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
   */
  FastMatcher.prototype.getMatches = function getMatches(prefix) {
    if (this.options.caseInsensitive) {
      prefix = prefix.toLowerCase();
    }

    var limit    = Number(this.options.limit || 25),
        selector = this.selector;

    var list    = this.list,
        matches = this.matches,
        index   = this.findIndex(prefix);

    matches.length = 0;

    var items = [], item;
    while (index < list.length) {
      if (matches.length === limit) {
        break;
      }

      item = selector(list[index].val);
      if (this.options.caseInsensitive) {
        item = item.toLowerCase();
      }

      if (!startsWith(item, prefix)) {
        break;
      }

      items.push(list[index++]);
    }

    if (this.options.preserveOrder) {
      items.sort(function(x, y) { return compare(x.i, y.i); });
    }

    matches.push.apply(matches, items.map(function(x) { return x.val; }));

    return matches;
  };

  FastMatcher.prototype.findIndex = function findIndex(prefix) {
    var list     = this.list,
        selector = this.selector,
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
