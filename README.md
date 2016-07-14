# PantoJS
[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][coveralls-image]][coveralls-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url] [![Stories in Ready][waffle-image]][waffle-url]

_**[PantoJS](http://pantojs.xyz/)**_ is an ambitious file-transforming task runner. It supports simultaneous & furcal transforming streams, incremental transforming and stream nodes cache, which make file-transforming much flexible and fast. See <http://pantojs.xyz/> for more details.

```js
const panto = require('panto');

panto.setOptions({
    cwd: 'your_project_dir'
});

// Isomorphic JavaScript
const srcJs = panto.pick('**/*.{js,jsx}').read();

srcJs.babel(clientBabelOptions).write().end();

srcJs.babel(serverBabelOptions).write().end();

// Less
panto.pick('**/*.less').read().less().write().end();

// Others
panto.rest().read().filter().write().end();

panto.build().then(() => {
    panto.watch();
});
```

Some official transformers: [read](https://github.com/pantojs/panto-transformer-read), [write](https://github.com/pantojs/panto-transformer-write), [babel](https://github.com/pantojs/panto-transformer-babel), [filter](https://github.com/pantojs/panto-transformer-filter), [ignore](https://github.com/pantojs/panto-transformer-ignore), [integrity](https://github.com/pantojs/panto-transformer-integrity), [less](https://github.com/pantojs/panto-transformer-less), [uglify](https://github.com/pantojs/panto-transformer-uglify), [stamp](https://github.com/pantojs/panto-transformer-stamp), [aspect](https://github.com/pantojs/panto-transformer-aspect).

Create your own _transformer_, just extend [panto-transformer](https://github.com/pantojs/panto-transformer), make sure _\_transform_ function returns a [Promise](https://promisesaplus.com/) object.

```js
panto.loadTransformer('foo') // panto-transformer-foo
panto.loadTransformer('bar', require('my-bar-transformer'))

panto.pick('*.js').foo(...).bar(...)
```

[npm-url]: https://npmjs.org/package/panto
[downloads-image]: http://img.shields.io/npm/dm/panto.svg
[npm-image]: http://img.shields.io/npm/v/panto.svg
[travis-url]: https://travis-ci.org/pantojs/panto
[travis-image]: http://img.shields.io/travis/pantojs/panto.svg
[david-dm-url]:https://david-dm.org/pantojs/panto
[david-dm-image]:https://david-dm.org/pantojs/panto.svg
[david-dm-dev-url]:https://david-dm.org/pantojs/panto#info=devDependencies
[david-dm-dev-image]:https://david-dm.org/pantojs/panto/dev-status.svg
[coveralls-image]:https://coveralls.io/repos/github/pantojs/panto/badge.svg?branch=master
[coveralls-url]:https://coveralls.io/github/pantojs/panto?branch=master
[waffle-image]:https://badge.waffle.io/pantojs/panto.png?label=ready&title=Ready
[waffle-url]:https://waffle.io/pantojs/panto