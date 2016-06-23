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
    /**
     * If it's a rest stream.
     *
     * Rest stream will add the files rest.
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

        if (this._matchFiles && (force || minimatch(diff.filename, this._pattern))) {
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
     * @return {stream} this
     */
    copy(fileCollection) {
        this._matchFiles.wrap(fileCollection);
        return this;
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
    /**
     * Fire an end event.
     * 
     * @param  {string} tag  This tag for friendly log
     * @return {stream} this
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