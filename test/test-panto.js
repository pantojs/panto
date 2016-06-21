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
const Panto = require('../');
const assert = require('assert');

describe('panto', () => {
    describe('#constructor', () => {
        it('should define frozen options', () => {
            const p = new Panto();
            assert.ok('options' in p);
            assert.throws(() => {
                p.options = 1;
            });
            assert.throws(() => {
                delete p.options
            });
        });
    });
});