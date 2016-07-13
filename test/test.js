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
            assert.ok(!!panto.options.get('cwd'), '"cwd" in panto.options');
            assert.ok(!!panto.options.get('output'), '"output" in panto.options');
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
            panto.setOptions({
                cwd: 'xyz'
            });
            assert.deepEqual(panto.getOption('cwd'), 'xyz', '"panto.options.cwd" equals "xyz"');
        });
    });
    describe('#getFiles', () => {
        it('should get the files', done => {
            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });
            panto.getFiles().then(filenames => {
                assert.ok(filenames.indexOf('javascripts/a.js') > -1,
                    'find "test.js"');
                done();
            });
        });
    });
    describe('#pick', () => {
        it('should pick the files', done => {
            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });
            
            const s = panto.pick('**/*.js').end();
            
            s.push({
                filename: 'javascripts/a.js',
                cmd: 'add'
            });
            
            s.flow().then(files => {
                assert.ok(files.some(file => file.filename === 'javascripts/a.js'), 'match "javascripts/a.js"');
            }).then(() => done());
        });
    });
    describe('#build#clear#rest', function () {
        this.timeout(3e3);
        it('should pick the rest', done => {
            const restFiles = [];

            class FinalTransformer extends Transformer {
                _transform(file) {
                    this.options.collection.push(file);
                    return super._transform(file);
                }
            }

            const jsFiles = [];
            const cssFiles = [];

            class CssTransformer extends Transformer {
                transformAll(files) {
                    const merged = files.map(file => (file.content || file.filename)).join(
                        '');
                    return Promise.resolve([{
                        filename: 'merge.css',
                        content: merged
                    }]);
                }
                isTorrential() {
                    return true;
                }
            }

            panto.setOptions({
                cwd: __dirname + '/fixtures/'
            });

            panto.clear();

            assert.deepEqual(panto._streams.length, 0, 'steams cleared');

            panto.rest().pipe(new FinalTransformer({
                collection: restFiles
            })).end('rest');

            panto.pick('**/*.js').pipe(new FinalTransformer({
                collection: jsFiles
            })).end('*.js');
            panto.pick('**/*.css').pipe(new CssTransformer()).pipe(new FinalTransformer({
                collection: cssFiles
            })).end('*.css');

            panto.build().then(() => {
                assert.ok(restFiles.some(file => file.filename === 'README.md'),
                    '"README.md" rested');
                assert.ok(jsFiles.some(file => file.filename === 'javascripts/a.js'),
                    '"javascripts/a.js" picked');
                assert.ok(jsFiles.some(file => file.filename === 'javascripts/b.js'),
                    '"javascripts/b.js" picked');

                assert.ok(cssFiles.some(file => file.filename ===
                    'merge.css'), '"merge.css" created');
            }).then(() => {
                done();
            }).catch(e => console.error(e));
        });
    });
    describe('#loadTransformer', () => {
        it('should load the Transformer', () => {
            class Foo {}
            panto.loadTransformer('foo', Foo);
            assert.ok(isFunction(new Stream().foo), '"new Stream().foo" is function');
            assert.ok(new Stream().foo() instanceof Stream, '"new Stream().foo()" is an instance of "Foo"');
        });
    });
});
