/**
 * Copyright (C) 2016 pantojs.xyz
 * utils.js
 *
 * changelog
 * 2016-07-04[23:27:15]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.1.0
 * @since 0.1.0
 */
'use strict';

exports.defineFrozenProperty = (object, key, value, enumerable) => {
    Object.defineProperty(object, key, {
        value,
        writable: false,
        configurable: false,
        enumerable: !!enumerable
    });
};