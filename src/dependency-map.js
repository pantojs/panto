/**
 * Copyright (C) 2016 pantojs.xyz
 * dependency-map.js
 *
 * Dependency map represents a multiple
 * to multiple dependency relation.
 *
 * For example,
 * 
 * a.js   -> b.js
 *        -> c.js
 * a.css  -> a.jpg
 *        -> a.eot
 * d.js   -> a.js
 *        -> e.js
 *        -> a.css
 * a.html -> a.js
 *        -> b.js
 *        -> a.css
 *        -> b.css
 *        -> a.png
 *
 * Now we have a graph:
 * 
 * --------------------------
 * a.html -> a.js  -> b.js
 *                 -> c.js
 *        -> a.css -> a.jpg
 *                 -> a.eot
 *        -> b.css
 *        -> a.png
 * --------------------------
 * d.js   -> a.js  -> b.js
 *                 -> c.js
 *        -> e.js
 *        -> a.css -> a.jpg
 *                 -> a.eot
 * --------------------------
 *
 * Note that any change on a node MUST
 * affect its ancestors, so we have to
 * be able to find all the ancestors of
 * the node.
 * 
 * changelog
 * 2016-06-26[21:15:34]:revised
 *
 * @author yanni4night@gmail.com
 * @version 1.0.0
 * @since 1.0.0
 */
'use strict';

const uniq = require('lodash/uniq');

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
    /**
     * Add a dependency pair. The KEY depends
     * on the VALUEs.
     * 
     * @param {string}    key
     * @param {...string} values
     */
    add(key, ...values) {
        let deps = this._map[key];

        if (!deps) {
            this._map[key] = deps = {};
        }

        values.forEach(dep => {
            if (dep !== key) {
                deps[dep] = 1; // any value truely
            }
        });

        return this;
    }
    /**
     * Unlink a dependency pair, or all pairs
     * if KEY is not present.
     * 
     * @param  {string|undefined} key
     * @return {DependencyMap} this
     */
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
    /**
     * Resolve the files who depend on the KEYs.
     * 
     * @param  {...string} keys
     * @return {Array}
     */
    resolve(...keys) {
        const result = [];

        uniq(keys).map(key => {
            this.resolveKey(key, result, key);
        });

        return result;// It's unique!
    }
    /**
     * Resolve the files who depend on a KEY.
     *
     * Preventing from "A" depends on "A", <b>ignore</b>
     * takes the origin key.
     * 
     * @param  {string} key
     * @param  {Array} result The dependencies
     * @param  {string} ignore
     * @return {undefined}
     */
    resolveKey(key, result, ignore) {
        for (let dfn in this._map) {
            if (result.indexOf(dfn) === -1 && dfn !== key && dfn !== ignore && this._map[dfn][key]) {
                result.push(dfn);
                this.resolveKey(dfn, result, ignore);
            }
        }
    }
}

module.exports = DependencyMap;