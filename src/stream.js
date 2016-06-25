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

/** Class representing a stream. */
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
            _cacheFiles: {
                value: new FileCollection(),
                writable: false,
                configurable: false,
                enumerable: true
            }
        });

        this.tag = '';
    }
    /**
     * Create a new child stream with transformer.
     *
     * Child's "end" event will fire parent too.
     * 
     * @param  {Transformer} transformer
     * @return {Stream} The new stream
     */
    pipe(transformer) {
        const child = new Stream(this, this._pattern, transformer);
        child.on('end', leaf => {
            this.emit('end', leaf);
        });
        return child;
    }
    /**
     * If it's a rest stream.
     *
     * Rest stream will add the files rested.
     * 
     * @return {Boolean}
     */
    isRest() {
        return null === this._pattern;
    }
    /**
     * If the file matches, or is forced,
     * then add the file.
     * 
     * @param  {object} file
     * @param  {Boolean} force
     * @return {Boolean} If added
     */
    swallow(file, force) {
        if (this.isRest() && !force) {
            return false;
        } else if (this._matchFiles && (force || minimatch(file.filename, this._pattern))) {
            this._matchFiles.add(file);
            return true;
        } else {
            return false;
        }
    }
    /**
     * Try to fixed the matched/cached files according to diffs.
     * 
     * @param  {object} diff
     * @param  {Boolean} force
     * @return {Boolean} If fixed
     */
    fix(diff, force) {
        if ('change' === diff.cmd || 'remove' === diff.cmd) {
            this._cacheFiles.remove(diff.filename);
        }

        if (this._parent) {
            this._parent.fix(diff, force);
        }

        if (this._matchFiles && (force || (this._pattern && minimatch(diff.filename, this._pattern)))) {
            // clear content
            this._matchFiles.update(diff);

            return true;
        }
        return false;
    }
    /**
     * Copy the files in fileCollection to 
     * the added file collection.
     * 
     * @param  {FileCollection} fileCollection
     * @return {Stream} this
     */
    copy(fileCollection) {
        this._matchFiles.wrap(fileCollection);
        return this;
    }
    /**
     * Flow the files, if has parent, parent flows first.
     * 
     * @param  {Array} files 
     * @return {Promise}
     */
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
    /**
     * Flow the files myself. Use cache is possible.
     * 
     * @param  {Array}  files
     * @return {Promise}
     */
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
    /**
     * Fire an end event.
     * 
     * @param  {string} tag  This tag for friendly log
     * @return {Stream} this
     */
    end(tag) {
        this.tag = tag;

        // The ended stream can have matches files
        Object.defineProperty(this, '_matchFiles', {
            value: new FileCollection(),
            writable: false,
            configurable: false,
            enumerable: true
        });

        this.emit('end', this);
        return this;
    }
}

module.exports = Stream;