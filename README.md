# PantoJS<sup>®</sup>
[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][coveralls-image]][coveralls-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url] [![Stories in Ready][waffle-image]][waffle-url]

_**[PantoJS<sup>®</sup>](http://pantojs.xyz/)**_ is an ***extreme flexible*** file-transforming task runner built for web front-ended projects, but is suitable for any kinds of building tasks. See <http://pantojs.xyz/> for more details.

```js
/*
PantoJS can run quite complicated tasks more than you think!

 
js-----------babel(client)--------|
   |                              |
   |                              |
   |---------babel(server)--------|
                                  |
                                  |
less---------less----------------write

others-------ignore--------------copy
*/

const panto = require('panto');

panto.setOptions({
    cwd: 'your_project_dir',
    src: 'src',
    output: 'output' // Cannot be same to src
});

// Isomorphic JavaScript
const srcJs = panto.pick('**/*.{js,jsx}').tag('js(x)').read();

srcJs.babel(clientBabelOptions).write();

srcJs.babel(serverBabelOptions).write();

// Less
panto.pick('**/*.less').tag('less').read().less().write();

// Others
panto.rest().tag('others').ignore().copy();

panto.on('start', () => {})// tasks start, for build & watch
    .on('error', err => {})// any tasks error, for build & watch
    .on('complete', files => {})// tasks runnning complete, for build & watch

panto.build().then(() => {
    panto.watch();
});
```

Some official transformers: [read](https://github.com/pantojs/panto-transformer-read), [write](https://github.com/pantojs/panto-transformer-write), [babel](https://github.com/pantojs/panto-transformer-babel), [filter](https://github.com/pantojs/panto-transformer-filter), [ignore](https://github.com/pantojs/panto-transformer-ignore), [integrity](https://github.com/pantojs/panto-transformer-integrity), [less](https://github.com/pantojs/panto-transformer-less), [uglify](https://github.com/pantojs/panto-transformer-uglify), [stamp](https://github.com/pantojs/panto-transformer-stamp), [aspect](https://github.com/pantojs/panto-transformer-aspect), [browserify](https://github.com/pantojs/panto-transformer-browserify), [replace](https://github.com/pantojs/panto-transformer-replace).

Create your own _transformer_, just extend [panto-transformer](https://github.com/pantojs/panto-transformer), make sure _\_transform_ or _transformAll_ function returns a [Promise](https://promisesaplus.com/), override _isTorrential_ if necessary.

```js
panto.loadTransformer('foo') // panto-transformer-foo
panto.loadTransformer('bar', require('my-bar-transformer'))

// Alias for pick
panto.$('*.js').foo(...).bar(...)
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