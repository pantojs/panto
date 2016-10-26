# ![panto](https://cloud.githubusercontent.com/assets/1710436/19589327/3877fd5c-979e-11e6-8e72-3dea494a52f5.png)
[![NPM version][npm-image]][npm-url] [![Downloads][downloads-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Build status][appveyor-image]][appveyor-url] [![Coverage Status][coveralls-image]][coveralls-url] [![Dependency status][david-dm-image]][david-dm-url] [![Dev Dependency status][david-dm-dev-image]][david-dm-dev-url]

[![NPM](https://nodei.co/npm/panto.png?downloads&downloadRank)](https://nodei.co/npm/panto/)

#### [中文版 README](README_CN.md)

_**[PantoJS](http://pantojs.xyz/)**_ is an ***extremely flexible*** file transforming engine. It is usually used for building projects, especially web front-end projects.

It works like [Grunt](http://gruntjs.com) or [Gulp](http://gulpjs.com), but more **efficient**, **powerful** and **flexible**. 

# Core Features

+ Any building process topology

> _Panto_ supports almost any building process

+ Collecting rest files

> You can select rest files that not selected by selectors

+ Read a file once at most

> Read a file only once, even more than one transforming on a file

+ Transform a file once at most

> Avoid duplicated processing

+ Cache at file

> Avoid duplicated transforming

+ Incremental file transforming

> More efficient watching

## Panto vs Grunt/Gulp

|                     | Grunt | Gulp | Panto |
| ------------------- | ----- | ---- | ----- |
| Stream task         | ✘     | ✔    | ✔     |
| Topological process | ✘     | ✘    | ✔     |
| Read once           | ✘     | ✘    | ✔     |
| Accurate cache      | ✘     | ✘    | ✔     |
| Accurate increment  | ✘     | ✘    | ✔     |

## Quick Start

Like _Grunt_ or _Gulp_, _Panto_ needs a process configurable file _pantofile.js_ in root directory of your project, [coffeescript](http://coffeescript.org) syntax is not supported. A simplest  _pantofile.js_ contains:

```javascript
module.exports = panto => {};
```

> Notice that _Panto_ requires _Node.js_ 6.0.0 or higher, so feel relieved to write ES2015 codes.

Like loading _Grunt/Gulp_ plugins, transformers should be loaded first. A transformer defines how to transform file contents.

```javascript
module.exports = panto => {
    panto.loadTransformer('read');
    panto.loadTransformer('less');
    panto.loadTransformer('copy');
    panto.loadTransformer('write');
};
```

The above needs to install some npm packages:

```sh
npm install panto panto-transformer-read panto-transformer-less panto-transformer-copy panto-transformer-write --save-dev
```

Next, we need to define some parameters: `cwd`/`src`/`output`. `src` and `output` are relative to `cwd`:

```javascript
panto.setOptions({
    cwd: __dirname,
    src: 'src',
    output: 'output'
});
```

Now we start to define building process. Here we transform _.less_ files as an example:

```javascript
panto.pick('*.less').read().less().write();
```

The above codes search _.less_ files in `src` directory, read them, transform to css format, and write to `output`. E.g., _src/style/foo.less_ transformed to _output/style/foo.less_.

Then we copy files other than _.less_ files to `output`:

```javascript
panto.rest().copy();
```

i.e. _src/config/c.yml_ copied to _output/config/c.yml_.

The total _pantofile.js_ is:

```javascript
module.exports = panto => {
    panto.loadTransformer('read');
    panto.loadTransformer('less');
    panto.loadTransformer('copy');
    panto.loadTransformer('write');

    panto.setOptions({
        cwd: __dirname,
        src: 'src',
        output: 'output'
    });

    panto.pick('*.less').read().less().write();
    panto.rest().copy();
};
```

You can use [load-panto-transformers](http://npmjs.org/load-panto-transformers) to avoid writing many _panto.loadTransformer('xxx')_ statements.  [time-panto](http://npmjs.org/time-panto) is used for monitor, the simpler _pantofile.js_ is:

```javascript
module.exports = panto => {
    require('load-panto-transformers')(panto);
    require('time-panto')(panto);

    panto.setOptions({
        cwd: __dirname,
        src: 'src',
        output: 'output'
    });

    panto.pick('*.less').read().less().write();
    panto.rest().copy();
};
```

At last, for starting tasks in terminal, you need to install [panto-cli](http://npmjs.org/panto-cli) first:

```sh
npm install panto-cli -g
```

Run:

```javascript
panto -f pantofile.js
```

All above are in <https://github.com/pantojs/simple-panto-usage>.

## Transformer

Transformers define logic of how to transform files. Extend [*panto-transformer*](http://npmjs.org/panto-transformer) to implement a transformer:

```javascript
const Transformer = require('panto-transformer');

class FooTransformer extends Transformer {
    _transform(file) {
        file.content += 'A';
        return Promise.resolve(file);
    }
    isTorrential() {
      return false;
    }
    isCacheable() {
      return true;
    }
}

module.exports = FooTransformer;
```

If the files are transformed independently, just implement _\_transform()_ function, or else _transformAll()_, they both return `Promise` object, distinguished by _isTorrential()_ function. Please see  [panto-transformer-browserify](https://github.com/pantojs/panto-transformer-browserify) and [panto-transformer-uglify](https://github.com/pantojs/panto-transformer-uglify).

If a transformer is idempotent strictly, it's cacheable, _isCacheable()_ returns true. Any factors beyond file content that affect transforming results between two transformings will lead to uncacheable. E.g., for calculating md5 of content, same content result in same md5 value, affected by no factors. As another example, appending current date time to file content result in uncacheable, of course.

Input and output of transformers are files or file arrays. A file is a plain JavaScript object, contains _filename_ and _content_ these two properties at least. You can append other properties too.

## Stream

_Panto_ uses _stream_ to define transforming tasks. As a node, streams consist of a directed acyclic graph.

```javascript
const Stream = require('panto').Stream;
const s1 = new Stream();
const s2 = new Stream();
const s3 = new Stream();
const s4 = new Stream();

s1.connect(s2).connect(s4);
s1.connect(s3);
```

Above codes construct a topology graph:

![](http://ww3.sinaimg.cn/large/801b780ajw1f8a9v754gvj20el0493ye.jpg)

A stream needs a transformer as a constructing parameter, or nothing is acceptable too.

```javascript
new Stream(new Transformer())
```

By defining topological streams and transformers, you can describe how to build a project easily and clearly. The following is a complicated building process topology:

![panto topology](panto.png)

A more typical configurable case:

```js
module.exports = panto => {
	panto.setOptions({
    	cwd: __dirname,
	    src: 'src',
    	output: 'output' // not as same as src
	});

	require('load-panto-transformers')(panto);

	const srcJs = panto.pick('**/*.{js,jsx}').tag('js(x)').read();

	srcJs.babel(clientBabelOptions).write();

	srcJs.babel(serverBabelOptions).write();

	panto.pick('**/*.less').tag('less').read().less().write();

	// node_modules should be processed only once
	panto.pick('node_modules/**/*', true).tag('node_modules').copy();

	panto.rest().tag('others').ignore().copy();
}
```

## API

`Panto` is available through API:

```javascript
const panto = require('panto');

panto.setOptions({
    
});

panto.on('start', buildId => {})
    .on('flowstart', ({tag}, flowId) => {})
    .on('flowend', ({tag}, flowId) => {})
    .on('error', (err, buildId) => {})
    .on('complete', (files, buildId) => {})

panto.build().then(() => {
    panto.watch();
});
```

## Options

 - cwd: string, current working directory, default `process.cwd()`
 - src: string, source directory, default '.'
 - output: output string, file directory, default 'output' 
 - binary_resource: string, binary file extensions, e.g. 'zip,tar,jpg', default is same as [binary-extensions](http://npmjs.org/binary-extensions)
 - watch_ignore: array, ignored files when watching, e.g. '["**/*.pyc", "**/*.class"]', default is []

## Boilerplate

- [panto-best-practice](https://github.com/pantojs/panto-best-practice)
- [simple-panto-usage](https://github.com/pantojs/simple-panto-usage)

## Transformers

Some official transformers: 

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



[npm-url]: https://npmjs.org/package/panto
[downloads-image]: http://img.shields.io/npm/dm/panto.svg
[npm-image]: http://img.shields.io/npm/v/panto.svg
[travis-url]: https://travis-ci.org/pantojs/panto
[travis-image]: http://img.shields.io/travis/pantojs/panto.svg
[appveyor-url]: https://ci.appveyor.com/project/yanni4night/panto-q51dg
[appveyor-image]: https://ci.appveyor.com/api/projects/status/2obj09670i41foek?svg=true
[david-dm-url]:https://david-dm.org/pantojs/panto
[david-dm-image]:https://david-dm.org/pantojs/panto.svg
[david-dm-dev-url]:https://david-dm.org/pantojs/panto?type=dev
[david-dm-dev-image]:https://david-dm.org/pantojs/panto/dev-status.svg
[coveralls-image]:https://coveralls.io/repos/github/pantojs/panto/badge.svg?branch=master
[coveralls-url]:https://coveralls.io/github/pantojs/panto?branch=master
[waffle-image]:https://badge.waffle.io/pantojs/panto.png?label=ready&amp;title=Ready
[waffle-url]:https://waffle.io/pantojs/panto
