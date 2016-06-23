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

/*global describe,it*/
describe('panto', () => {
    describe('#constructor', () => {
        it('should define frozen options', () => {
            assert.ok('options' in panto);
            assert.throws(() => {
                panto.options = 1;
            });
            assert.throws(() => {
                delete panto.options;
            });
        });
    });
    describe('#getFiles', () => {
        it('should get the files', done => {
            panto.setOptions({
                cwd: __dirname
            });
            panto.getFiles().then(filenames => {
                assert.ok(filenames.indexOf('test-panto.js') > -1);
                assert.ok(filenames.indexOf('test-stream.js') > -1);
                done();
            });
        });
    });
    describe('#pick', () => {
        it('should pick the files', () => {
            panto.setOptions({
                cwd: __dirname
            });
            assert.ok(panto.pick('*-panto.js').match('test-panto.js'));
        });
    });
});