/**
 * Copyright (C) 2016 pantojs.xyz
 * file-collection.js
 *
 * changelog
 * 2016-07-05[23:15:38]:revised
 *
 * @author yanni4night@gmail.com
 * @version 0.1.0
 * @since 0.1.0
 */
'use strict';

const defineFrozenProperty = require('define-frozen-property');

/** Class representing a file collection. */
class FileCollection {
    constructor() {
        defineFrozenProperty(this, '_fileMap', new Map());
    }
    /**
     * Add a file if has not or be forced.
     * 
     * @param  {object} file
     * @param  {Boolean} force
     * @return {FileCollection} this
     */
    add(file, force) {
        const {_fileMap} = this;

        if (file && (force || !(_fileMap.has(file.filename)))) {
            _fileMap.set(file.filename, file);
        }
        return this;
    }
    /**
     * Remove a file.
     * 
     * @param  {string} filename
     * @return {FileCollection} this
     */
    remove(filename) {
        delete this._fileMap.delete(filename);
        return this;
    }
    /**
     * Truncate a file.
     * 
     * @param  {string} filename
     * @return {FileCollection} this
     */
    refresh(filename) {
        const file = this._fileMap.get(filename);
        if (file) {
            file.content = null;
        }
        return this;
    }
    /**
     * Get files as an array.
     * 
     * @return {array}
     */
    values() {
        const values = [];
        const it = this._fileMap.values();
        let val;
        
        while (!(val = it.next()).done) {
            values.push(val.value);
        }
        
        return values;
    }
    /**
     * Update one file at most according to diff.
     * 
     * @param  {object} diff Diff object like {cmd:'change',filename:'a.js'}
     * @return {FileCollection} this
     */
    update(diff) {
        switch (diff.cmd) {
        case 'add':
            this.add({
                filename: diff.filename,
                content: diff.content
            });
            break;
        case 'change':
            this.refresh(diff.filename);
            break;
        case 'remove':
            this.remove(diff.filename);
            break;
        default:
            throw new Error(`"${diff.cmd}" is not supported when update a file collection`);
        }
        return this;
    }
}

module.exports = FileCollection;