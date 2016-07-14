/**
 * Copyright (C) 2016 panto.xyz
 * test.js
 *
 * changelog
 * 2016-06-21[19:03:41]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.0.16
 * @since 0.0.1
 */
'use strict';

const Panto = require('../src/panto');
const panto = require('../');
const assert = require('assert');
const Transformer = require('panto-transformer');
const Stream = require('panto-stream');
const {
    isFunction
} = require('lodash');

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
    describe('#pick', () => {
        it('should pick the files', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });

            const s = panto.pick('**/*.js').end('js');

            s.push({
                filename: 'javascripts/a.js',
                cmd: 'add'
            });

            s.flow().then(files => {
                assert.ok(files.some(file => file.filename === 'javascripts/a.js'),
                    'match "javascripts/a.js"');
            }).then(() => done());
        });
    });

    describe('#build', function () {
        this.timeout(2e3);
        it('should get all the files', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });

            panto.pick('**/*.js').end('js');
            panto.pick('**/*.css').end('css');

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
    });

    describe('#clear', function () {
        this.timeout(2e3);
        it('should clear streams', done => {
            const panto = new Panto();

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });

            panto.pick('**/*.js').end('js');

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


            panto.rest().pipe(new FinalTransformer({
                collection: restFiles
            })).end('rest');

            panto.pick('**/*.js').end('*.js');
            panto.pick('**/*.css').end('*.css');

            panto.build().then(() => {
                assert.ok(restFiles.some(file => file.filename === 'README.md'),
                    '"README.md" rested');
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