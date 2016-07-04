/**
 * Copyright (C) 2016 pantojs.xyz
 * options.js
 *
 * changelog
 * 2016-07-04[23:18:18]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.1.0
 * @since 0.1.0
 */
'use strict';
const extend = require('lodash/extend');
const {defineFrozenProperty} = require('./utils');

class Options {
    constructor(opts) {
        defineFrozenProperty(this,'_options',extend({}, opts));    }
    extend(extendable) {
        extend(this._options, extendable);
        return this;
    }
    get(key) {
        return this._options[key];
    }
    set(key, value) {
        return (this._options[key] = value);
    }
}

module.exports = Options;