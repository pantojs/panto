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
            assert.ok(Object.isFrozen(panto.file), '"panto.file" is frozen');
            assert.throws(() => {
                panto.file = 1;
            }, 'set "panto.file"');
            assert.throws(() => {
                delete panto.file;
            }, 'delete "panto.file"');
        });
        it('should define frozen "util"', () => {
            assert.ok('util' in panto, '"util" in panto');
            assert.ok(Object.isFrozen(panto.util), '"panto.util" is frozen');
            assert.throws(() => {
                panto.util = 1;
            }, 'set "panto.util"');
            assert.throws(() => {
                delete panto.util;
            }, 'delete "panto.util"');
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
            assert.ok(panto.pick('*-panto.js').end().swallow({
                filename: 'test-panto.js'
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

            panto.setOptions({
                cwd: __dirname + '/..'
            });

            panto.clear();

            panto.rest().pipe(new RestTransformer()).end('rest');
            panto.pick('**/*.js').end('*.js');
            panto.pick('*.md').end('*.md');

            panto.build().then(() => {
                console.log(restFiles)
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