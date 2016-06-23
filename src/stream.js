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
            parent: {
                value: parent,
                writable: false,
                configurable: false,
                enumerable: true
            },
            pattern: {
                value: pattern,
                writable: false,
                configurable: false,
                enumerable: true
            },
            transformer: {
                value: transformer,
                writable: false,
                configurable: false,
                enumerable: true
            },
            matchFiles: {
                value: new FileCollection(),
                writable: false,
                configurable: false,
                enumerable: true
            },
            cacheFiles: {
                value: new FileCollection(),
                writable: false,
                configurable: false,
                enumerable: true
            }
        });

        this.tag = '';
    }
    pipe(transformer) {
        const child = new Stream(this, this.pattern, transformer);
        child.on('end', leaf => {
            this.emit('end', leaf);
        });
        return child;
    }
    match(filename) {
        if (!this.pattern) {
            return false;
        }
        return minimatch(filename, this.pattern);
    }
    flow(files) {
        files = files || this.matchFiles.values();

        if (this.parent) {
            return this.parent.flow(files).then(files => {
                return this._flow(files);
            });
        } else {
            return this._flow(files);
        }
    }
    _flow(files = []) {
        const tasks = files.map(file => {
            if (this.cacheFiles.has(file.filename)) {
                return Promise.resolve(this.cacheFiles.get(file.filename));
            } else if (this.transformer) {
                return this.transformer.transform(file).then(files => {
                    if (!Array.isArray(files)) {
                        files = [files];
                    }

                    return files.filter(file => !!file).map(file => {
                        this.cacheFiles.add(extend({}, file), true);
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
            this.cacheFiles.remove(filename);
        });

        if (this.parent) {
            this.parent.refreshCache(diffs);
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