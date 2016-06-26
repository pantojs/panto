/**
 * Copyright (C) 2016 pantojs.xyz
 * dependency-map.js
 *
 * changelog
 * 2016-06-26[21:15:34]:revised
 *
 * @author yanni4night@gmail.com
 * @version 1.0.0
 * @since 1.0.0
 */
'use strict';

/** Class representing a dependency map */
class DependencyMap {
    constructor() {
        Object.defineProperties(this, {
            _map: {
                value: {},
                writable: false,
                configurable: false,
                enumerable: false
            }
        });
    }
    add(key, ...values) {
        let deps = this._map[key];

        if (!deps) {
            this._map[key] = deps = {};
        }

        values.forEach(dep => {
            deps[dep] = 1; // any value truely
        });

        return this;
    }
    clear(key) {
        if (!key) {
            Object.keys(this._map).forEach(key => {
                this.clear(key);
            });
        } else {
            delete this._map[key];
        }
        return this;
    }
    resolve(...keys) {
        const result = [];
        keys.map(key => {
            this.resolveKey(key, result);
        });
        return result;
    }
    resolveKey(key, result) {
        for (let dfn in this._map) {
            if (result.indexOf(dfn) === -1 && this._map[dfn][key]) {
                result.push(dfn);
                this.resolveKey(dfn, result);
            }
        }
    }
}

module.exports = DependencyMap;