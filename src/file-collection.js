/**
 * Copyright (C) 2016 yanni4night.com
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

const File = require('./file');
const values = require('lodash/values');

class FileCollection {
    constructor(...filenames) {
        // Lock this.fileObjects
        Object.defineProperty(this, 'fileObjects', {
            value: {},
            writable: false,
            configurable: false,
            enumerabel: true
        });
        this.from(...filenames);
    }
    from(...filenames) {

        filenames.forEach(filename => {
            this.fileObjects[filename] = new File(filename);
        });

        return this;
    }
    has(filename) {
        return filename in this.fileObjects;
    }
    get(filename) {
        return this.fileObjects[filename];
    }
    add(file, force) {
        const {
            fileObjects
        } = this;

        if (force || !(file.filename in fileObjects)) {
            fileObjects[file.filename] = file;
        }
        return this;
    }
    remove(filename) {
        delete this.fileObjects[filename];
        return this;
    }
    refresh(filename) {
        const file = this.fileObjects[filename];
        if (file) {
            file.truncate();
        }
        return this;
    }
    values() {
        return values(this.fileObjects);
    }
    update(diff) {
        switch (diff.cmd) {
        case 'add':
            this.add(new File(diff.filename));
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