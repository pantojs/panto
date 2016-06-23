/**
 * Copyright (C) 2016 pantojs.xyz
 * stream.js
 *
 * changelog
 * 2016-06-20[14:47:49]:revised
 *
 * @author yanni4night@gmail.com
 * @version 1.0.0
 * @since 1.0.0
 */
'use strict';
const minimatch = require('minimatch');
const FileCollection = require('./file-collection');
const EventEmitter = require('events');
const flattenDeep = require('lodash/flattenDeep');
const extend = require('lodash/extend');

class Stream extends EventEmitter {
    constructor(parent, pattern, transformer) {
        super();
        Object.defineProperties(this, {
            _parent: {
                value: parent,
                writable: false,
                configurable: false,
                enumerable: true
            },
            _pattern: {
                value: pattern,
                writable: false,
                configurable: false,
                enumerable: true
            },
            _transformer: {
                value: transformer,
                writable: false,
                configurable: false,
                enumerable: true
            },
            _matchFiles: {
                value: new FileCollection(),
                writable: false,
                configurable: false,
                enumerable: true
            },
            _cacheFiles: {
                value: new FileCollection(),
                writable: false,
                configurable: false,
                enumerable: true
            }
        });

        this.tag = '';
    }
    pipe(transformer) {
        const child = new Stream(this, this._pattern, transformer);
        child.on('end', leaf => {
            this.emit('end', leaf);
        });
        return child;
    }
    match(filename) {
        if (!this._pattern) {
            return false;
        }
        return minimatch(filename, this._pattern);
    }
    flow(files) {
        files = files || this._matchFiles.values();

        if (this._parent) {
            return this._parent.flow(files).then(files => {
                return this._flow(files);
            });
        } else {
            return this._flow(files);
        }
    }
    _flow(files = []) {
        const tasks = files.map(file => {
            if (this._cacheFiles.has(file.filename)) {
                return Promise.resolve(this._cacheFiles.get(file.filename));
            } else if (this._transformer) {
                return this._transformer.transform(file).then(files => {
                    if (!Array.isArray(files)) {
                        files = [files];
                    }

                    return files.filter(file => !!file).map(file => {
                        this._cacheFiles.add(extend({}, file), true);
                        return file;
                    });

                });
            } else {
                return Promise.resolve(file);
            }
        });
        return Promise.all(tasks).then(flattenDeep);
    }
    refreshCache(diffs) {

        if (!diffs) {
            return this;
        }

        diffs.remove.slice().concat(diffs.change).forEach(filename => {
            this._cacheFiles.remove(filename);
        });

        if (this._parent) {
            this._parent.refreshCache(diffs);
        }

        return this;
    }
    end(tag) {
        this.tag = tag;
        this.emit('end', this);
        return this;
    }
}

module.exports = Stream;