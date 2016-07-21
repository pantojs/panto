/**
 * Copyright (C) 2016 panto.xyz
 * test.js
 *
 * changelog
 * 2016-06-21[19:03:41]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.0.24
 * @since 0.0.1
 */
'use strict';

const Panto = require('../src/panto');
const panto = require('../');
const fs = require('fs');
const assert = require('assert');
const Transformer = require('panto-transformer');
const Stream = require('panto-stream');
const isFunction = require('lodash/isFunction');

/*global describe,it*/
/*eslint no-console: ["error", { allow: ["error"] }] */
describe('panto', () => {
    describe('#constructor', () => {
        it('should define frozen "options"', () => {
            assert.ok('options' in panto, '"options" in panto');
            assert.ok(!!panto.options.get('output'), '"output" in panto.options');
            assert.deepEqual(panto.options.get('cwd'), process.cwd(), '"cwd" in panto.options');
            assert.ok('' === panto.options.get('binary_resource'),
                '"binary_resource" in panto.options');
            assert.throws(() => {
                panto.options = 1;
            }, 'set "panto.options"');
            assert.throws(() => {
                delete panto.options;
            }, 'delete "panto.options"');
        });
        it('should define frozen "file"', () => {
            assert.ok('file' in panto);
            assert.throws(() => {
                delete panto.file;
            }, '"panto.file" is frozen');
        });
        it('should define frozen "util"', () => {
            assert.ok('util' in panto, '"util" in panto');
            assert.ok('_' in panto, '"_" in panto');
            assert.throws(() => {
                delete panto._;
            }, '"panto._" is frozen');
        });
    });
    describe('#setOptions#getOption', () => {
        it('should set to the options', () => {
            const panto = new Panto();
            panto.setOptions({
                cwd: 'xyz'
            });
            assert.deepEqual(panto.getOption('cwd'), 'xyz', '"panto.options.cwd" equals "xyz"');
            assert.deepEqual(panto.getOption('noexist', 'default'), 'default', 'get default');
        });
    });
    describe('#getFiles', () => {
        it('should get the files', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });

            panto.getFiles().then(filenames => {
                assert.ok(filenames.indexOf('javascripts/a.js') > -1,
                    'found "javascripts/a.js"');
                assert.ok(filenames.indexOf('javascripts/b.js') > -1,
                    'found "javascripts/b.js"');
                done();
            });
        });
    });

    describe('#build', function () {
        this.timeout(2e3);
        it('should get all the files', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });

            panto.pick('**/*.js').tag('js');
            panto.pick('**/*.css').tag('css');

            panto.build().then(files => {
                assert.ok(files.some(file => file.filename === 'javascripts/a.js'),
                    'match "javascripts/a.js"');
                assert.ok(files.some(file => file.filename === 'javascripts/b.js'),
                    'match "javascripts/a.js"');
                assert.ok(files.some(file => file.filename === 'stylesheets/a.css'),
                    'match "stylesheets/a.css"');
                assert.ok(files.some(file => file.filename === 'stylesheets/b.css'),
                    'match "stylesheets/b.css"');
            }).then(() => done());
        });
        it('should support equative src&output', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname,
                src: '/fixtures/',
                output: 'out'
            });

            const filename = `r/r-${Date.now()}.txt`;

            panto.file.write(filename, 'out').then(() => {
                assert.ok(fs.existsSync(__dirname + '/out/' + filename));
                return panto.file.rimraf('r', {
                    force: true
                });
            }).then(() => done()).catch(e => console.error(e));
        });
        it('should support serial src&output', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname,
                src: '/fixtures/',
                output: 'fixtures/out'
            });

            const filename = `r/r-${Date.now()}.txt`;

            panto.file.write(filename, 'out').then(() => {
                assert.ok(fs.existsSync(__dirname + '/fixtures/out/' + filename));
                return panto.file.rimraf('r', {
                    force: true
                });
            }).then(() => done()).catch(e => console.error(e));
        });
        it('should throw if src and output are same', () => {
            const panto = new Panto();
            panto.setOptions({
                cwd: '.',
                src: 'foo',
                output: './foo'
            });
            assert.throws(() => {
                panto.build();
            }, 'throws error');
        });
    });

    describe('#clear', function () {
        this.timeout(2e3);
        it('should clear streams', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });

            panto.pick('**/*.js').tag('js');

            panto.build().then(files => {
                assert.ok(files.some(file => file.filename === 'javascripts/a.js'),
                    'match "javascripts/a.js"');
                assert.ok(files.some(file => file.filename === 'javascripts/b.js'),
                    'match "javascripts/a.js"');
            }).then(() => {
                assert.deepEqual(panto.clear(), panto, 'clear() return self');
                return panto.build();
            }).then(files => {
                assert.deepEqual(files, [], 'no files due to no streams');
            }).then(() => done());
        });
    });

    describe('#rest', function () {
        this.timeout(3e3);
        it('should pick the rest', done => {
            const restFiles = [];

            class FinalTransformer extends Transformer {
                _transform(file) {
                    this.options.collection.push(file);
                    return super._transform(file);
                }
            }

            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });

            panto.rest().tag('rest').connect(new Stream(new FinalTransformer({
                collection: restFiles
            })));

            panto.pick('**/*.js').tag('js');
            panto.pick('**/*.css').tag('css');

            panto.build().then(() => {
                assert.ok(restFiles.some(file => file.filename === 'README.md'),
                    '"README.md" rested');
            }).then(() => done()).catch(e => console.error(e));
        });
    });
    describe('#onFileDiff', function () {
        this.timeout(5e3);
        it('', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });
            panto.pick('**/*.js').tag('js');
            panto.rest().tag('rest');
            panto.build().then(() => {
                return panto.onFileDiff({
                    filename: 'javascripts/c.js',
                    cmd: 'add'
                });
            }).then(files => {
                assert.ok(files.some(file => file.filename === 'javascripts/c.js'),
                    '"javascripts/c.js" added');
                return panto.onFileDiff({
                    filename: 'javascripts/c.js',
                    cmd: 'remove'
                });
            }).then(files => {
                assert.ok(!files.some(file => file.filename === 'javascripts/c.js'),
                    '"javascripts/c.js" removed');
            }).then(() => {
                return panto.onFileDiff({
                    filename: 'rest.txt',
                    cmd: 'add'
                });
            }).then(files => {
                assert.ok(files.some(file => file.filename === 'rest.txt'),
                    '"rest.txt" added');
            }).then(() => done()).catch(e => console.error(e));

        });
    });
    describe('#watch', () => {
        it('should throw if src and output are same', () => {
            const panto = new Panto();
            panto.setOptions({
                cwd: '.',
                src: 'foo',
                output: './foo'
            });
            assert.throws(() => {
                panto.watch();
            }, 'throws error');
        });
    });

    describe('#reportDependencies', function () {
        it('should transform dependencies too', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });

            let jsInvoked = 0;

            class JsTransformer extends Transformer {
                _transform(file) {
                    jsInvoked += 1;
                    return super._transform(file);
                }
                isTorrential() {
                    return false;
                }
            }

            panto.pick('**/*.css').tag('css');
            panto.pick('**/*.js').tag('js').connect(new Stream(new JsTransformer()));

            panto.build().then(() => {
                panto.reportDependencies('javascripts/a.js', 'stylesheets/a.css');
                return panto.onFileDiff({
                    filename: 'stylesheets/a.css',
                    cmd: 'change'
                });
            }).then(() => {
                assert.deepEqual(jsInvoked, 3);
            }).then(() => done()).catch(e => console.error(e));
        });
    });
    describe('#loadTransformer', () => {
        it('should load the Transformer', () => {
            class Foo {}
            panto.loadTransformer('foo', Foo);
            assert.ok(isFunction(new Stream().foo), '"new Stream().foo" is function');
            assert.ok(new Stream().foo() instanceof Stream,
                '"new Stream().foo()" is an instance of "Foo"');
        });
    });
});
