/**
 * Copyright (C) 2016 pantojs.xyz
 * file-collection.js
 *
 * changelog
 * 2016-06-20[14:32:29]:revised
 *
 * @author yanni4night@gmail.com
 * @version 1.0.0
 * @since 1.0.0
 */
'use strict';

const values = require('lodash/values');
const extend = require('lodash/extend');

class FileCollection {
    constructor(...filenames) {
        Object.defineProperty(this, '_fileObjects', {
            value: {},
            writable: false,
            configurable: false,
            enumerabel: true
        });

        filenames.forEach(filename => {
            this._fileObjects[filename] = {
                filename
            };
        });
    }
    wrap(fileCollection) {
        extend(this._fileObjects, fileCollection._fileObjects);
        return this;
    }
    has(filename) {
        return filename in this._fileObjects;
    }
    get(filename) {
        return this._fileObjects[filename];
    }
    add(file, force) {
        const {
            _fileObjects
        } = this;

        if (force || !(file.filename in _fileObjects)) {
            _fileObjects[file.filename] = file;
        }
        return this;
    }
    remove(filename) {
        delete this._fileObjects[filename];
        return this;
    }
    refresh(filename) {
        const file = this._fileObjects[filename];
        if (file) {
            file.content = null;
        }
        return this;
    }
    values() {
        return values(this._fileObjects);
    }
    update(diff) {
        switch (diff.cmd) {
        case 'add':
            this.add({
                filename: diff.filename
            });
            break;
        case 'change':
            this.refresh(diff.filename);
            break;
        case 'remove':
            this.remove(diff.filename);
            break;
        }
    }
}

module.exports = FileCollection;