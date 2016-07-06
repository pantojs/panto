/**
 * Copyright (C) 2016 panto.xyz
 * test.js
 *
 * changelog
 * 2016-06-21[19:03:41]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.0.12
 * @since 0.0.12
 */
'use strict';
const panto = require('../');
const assert = require('assert');
const Transformer = require('panto-transformer');
const {
    isFunction
} = require('lodash');

/*global describe,it*/
describe('panto', () => {
    describe('#constructor', () => {
        it('should define frozen "options"', () => {
            assert.ok('options' in panto, '"options" in panto');
            assert.ok(!!panto.options.get('cwd'), '"cwd" in panto.options');
            assert.ok(!!panto.options.get('output'), '"output" in panto.options');
            assert.ok('' === panto.options.get('binary_resource'), '"binary_resource" in panto.options');
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
    describe('#setOptions#getOptions', () => {
        it('should set to the options', () => {
            panto.setOptions({
                cwd: 'xyz'
            });
            assert.deepEqual(panto.options.get('cwd'), 'xyz', '"panto.options.cwd" equals "xyz"');
        });
    });
    describe('#getFiles', () => {
        it('should get the files', done => {
            panto.setOptions({
                cwd: __dirname
            });
            panto.getFiles().then(filenames => {
                assert.ok(filenames.indexOf('test.js') > -1,
                    'match "test.js"');
                done();
            });
        });
    });
    describe('#pick', () => {
        it('should pick the files', () => {
            panto.setOptions({
                cwd: __dirname
            });
            assert.ok(panto.pick('*.js').end().fix({
                filename: 'test.js',
                cmd: 'add'
            }), 'match "test.js"');
        });
    });
    describe('#build#clear#rest', function() {
        this.timeout(3e3);
        it('should pick the rest', done => {
            const restFiles = [];

            class RestTransformer extends Transformer {
                _transform(file) {
                    restFiles.push(file);
                    return Promise.resolve(file);
                }
            }
            const jsFiles = [];
            class JsTransformer extends Transformer {
                _transform(file) {
                    jsFiles.push(file);
                    return Promise.resolve(file);
                }
            }

            panto.setOptions({
                cwd: __dirname + '/..'
            });

            panto.clear();

            assert.deepEqual(panto._streams.length, 0, 'steams cleared');

            panto.rest().pipe(new RestTransformer()).end('rest');
            panto.pick('**/*.js').pipe(new JsTransformer()).end('*.js');
            panto.pick('**/*.{md,json}').end('*.md');

            panto.build().then(() => {
                assert.ok(restFiles.some(file => file.filename === 'LICENSE'),
                    '"LICENSE" rested');
                assert.ok(jsFiles.some(file => file.filename === 'index.js'),
                    '"index.js" picked');
                assert.ok(jsFiles.some(file => file.filename === 'test/test.js'),
                    '"test/test.js" picked');
            }).then(() => {
                done();
            });
        });
    });
    describe('#loadTransformer', () => {
        it('should load the Transformer', () => {
            class Foo {}
            panto.loadTransformer('foo', Foo);
            assert.ok(isFunction(panto.foo), '"panto.foo" is function');
            assert.ok(panto.foo() instanceof Foo, '"panto.foo()" is an instance of "Foo"');
        });
    });
});