/**
 * Copyright (C) 2016 panto.xyz
 * test-panto.js
 *
 * changelog
 * 2016-06-21[19:03:41]:revised
 *
 * @author yanni4night@gmail.com
 * @version 1.0.0
 * @since 1.0.0
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
            assert.ok('cwd' in panto.options, '"cwd" in panto.options');
            assert.ok('output' in panto.options, '"cwd" in panto.output');
            assert.ok('binary_resource' in panto.options, '"cwd" in panto.binary_resource');
            assert.throws(() => {
                panto.options = 1;
            }, 'set "panto.options"');
            assert.throws(() => {
                delete panto.options;
            }, 'delete "panto.options"');
        });
        it('should define frozen "file"', () => {
            assert.ok('file' in panto);
            assert.ok(isFunction(panto.file.read), '"panto.file.read" is function');
            assert.ok(isFunction(panto.file.write), '"panto.file.write" is function');
            assert.ok(isFunction(panto.file.locate), '"panto.file.locate" is function');
            assert.ok(isFunction(panto.file.isBinary), '"panto.file.isBinary" is function');
            assert.ok(isFunction(panto.file.match), '"panto.file.isBinary" is function');
            assert.ok(Object.isFrozen(panto.file), '"panto.file" is frozen');
        });
        it('should define frozen "util"', () => {
            assert.ok('util' in panto, '"util" in panto');
            assert.ok(Object.isFrozen(panto.util), '"panto.util" is frozen');
        });
        it('should define "_streams"', () => {
            assert.ok('_streams' in panto, '"_streams" in panto');
            assert.ok(!Object.propertyIsEnumerable(panto, '_streams'));

            assert.throws(() => {
                panto._streams = 1;
            }, 'set "panto._streams"');
            assert.throws(() => {
                delete panto._streams;
            }, 'delete "panto._streams"');
        });
    });
    describe('#setOptions', () => {
        it('should set to the options', () => {
            panto.setOptions({
                cwd: 'xyz'
            });
            assert.deepEqual(panto.options.cwd, 'xyz', '"panto.options.cwd" equals "xyz"');
        });
    });
    describe('#getFiles', () => {
        it('should get the files', done => {
            panto.setOptions({
                cwd: __dirname
            });
            panto.getFiles().then(filenames => {
                assert.ok(filenames.indexOf('test-panto.js') > -1,
                    'match "test-panto.js"');
                assert.ok(filenames.indexOf('test-stream.js') > -1,
                    'match "test-stream.js"');
                done();
            });
        });
    });
    describe('#pick', () => {
        it('should pick the files', () => {
            panto.setOptions({
                cwd: __dirname
            });
            assert.ok(panto.pick('*-panto.js').end().fix({
                filename: 'test-panto.js',
                cmd: 'add'
            }), 'match "test-panto.js"');
        });
    });
    describe('#build#clear#rest', () => {
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
                assert.ok(jsFiles.some(file => file.filename === 'test/test-panto.js'),
                    '"test/test-panto.js" picked');
            }).then(()=>{
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