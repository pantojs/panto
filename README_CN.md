# PantoJS<sup>®</sup>
[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage Status][coveralls-image]][coveralls-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url]

_**[PantoJS<sup>®</sup>](http://pantojs.xyz/)**_ 是一个***极其灵活***的文件转换引擎。通常用于项目的构建和编译，特别是 Web 前端项目。

它比较类似于 [Grunt](http://gruntjs.com) 或 [Gulp](http://gulpjs.com)，但更**高效**、**强大**和**灵活**。

## 核心特征

+ 支持任意定义的拓扑构建流程

> 只要是你能定义出来的构建流程，无论如何复杂，只要是合理的，*PantoJS* 都可以支持

+ 支持遗留文件的收集

> 在选择特定的文件类型后，可以一次性访问到未被选择的其它文件

+ 保证对每个源文件最多读取一次

> 对于同一个文件存在一个以上不同的处理流程，读取也最只有一次

+ 保证对于每个文件的同样处理流程只有一次

> 尽最大努力避免重复工作

+ 支持文件级别的精确缓存，最大程度上避免不必要的计算

> 不必重新构建的文件，尽最大努力利用缓存

## 一个典型的构建流程

![panto topology](panto.png)

## 配置案例

```js
const panto = require('panto');

panto.setOptions({
    cwd: 'your_project_dir',
    src: 'src',
    output: 'output' // 不可以与src相同
});

/*
 * 需要先加载转换器
 */
require('load-panto-transformers')(panto);

// 同构 JavaScript
const srcJs = panto.pick('**/*.{js,jsx}').tag('js(x)').read();

srcJs.babel(clientBabelOptions).write();

srcJs.babel(serverBabelOptions).write();

// Less
panto.pick('**/*.less').tag('less').read().less().write();

// node_modules 的文件只需处理一次
panto.pick('node_modules/**/*', true).tag('node_modules').copy();

// 剩余文件
panto.rest().tag('others').ignore().copy();

panto.on('start', buildId => {})// tasks start, for build & watch
    .on('flowstart', ({tag}, flowId) => {})// one task starts, for build & watch
    .on('flowend', ({tag}, flowId) => {})// one task ends, for build & watch
    .on('error', (err, buildId) => {})// any tasks error, for build & watch
    .on('complete', (files, buildId) => {})// tasks runnning complete, for build & watch

panto.build().then(() => {
    panto.watch();
});
```


## 模板

- [panto-best-practice](https://github.com/pantojs/panto-best-practice)

## 转换器

一些官方的转换器：

- [read](https://github.com/pantojs/panto-transformer-read)
- [write](https://github.com/pantojs/panto-transformer-write)
- [babel](https://github.com/pantojs/panto-transformer-babel)
- [filter](https://github.com/pantojs/panto-transformer-filter)
- [ignore](https://github.com/pantojs/panto-transformer-ignore)
- [integrity](https://github.com/pantojs/panto-transformer-integrity)
- [less](https://github.com/pantojs/panto-transformer-less)
- [uglify](https://github.com/pantojs/panto-transformer-uglify)
- [stamp](https://github.com/pantojs/panto-transformer-stamp)
- [aspect](https://github.com/pantojs/panto-transformer-aspect)
- [browserify](https://github.com/pantojs/panto-transformer-browserify)
- [replace](https://github.com/pantojs/panto-transformer-replace)
- [copy](https://github.com/pantojs/panto-transformer-copy)
- [resource](https://github.com/pantojs/panto-transformer-resource)
- [banner](https://github.com/pantojs/panto-transformer-banner)

```js
panto.loadTransformer('foo') // panto-transformer-foo
panto.loadTransformer('bar', require('my-bar-transformer'))

// pick的别名
panto.$('*.js').foo(...).bar(...)
```

[npm-url]: https://npmjs.org/package/panto
[downloads-image]: http://img.shields.io/npm/dm/panto.svg
[npm-image]: http://img.shields.io/npm/v/panto.svg
[travis-url]: https://travis-ci.org/pantojs/panto
[travis-image]: http://img.shields.io/travis/pantojs/panto.svg
[david-dm-url]: https://david-dm.org/pantojs/panto
[david-dm-image]: https://david-dm.org/pantojs/panto.svg
[david-dm-dev-url]: https://david-dm.org/pantojs/panto?type=dev
[david-dm-dev-image]: https://david-dm.org/pantojs/panto/dev-status.svg
[coveralls-image]: https://coveralls.io/repos/github/pantojs/panto/badge.svg?branch=master
[coveralls-url]: https://coveralls.io/github/pantojs/panto?branch=master
