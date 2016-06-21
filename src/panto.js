/**
 * Copyright (C) 2016 pantojs.xyz
 * sieve.js
 *
 * changelog
 * 2016-06-21[18:46:42]:revised
 *
 * @author yanni4night@gmail.com
 * @version 1.0.0
 * @since 1.0.0
 */
'use strict';

const glob = require('glob');

const chokidar = require('chokidar');

const {
    info
} = require('./logger');

const isString = require('lodash/isString');
const isFunction = require('lodash/isFunction');
const extend = require('lodash/extend');
const Stream = require('./stream');
const File = require('./file');
const FileCollection = require('./file-collection');

class Panto {
    constructor(opts, taskRun) {
        const defaultOpts = {
            cwd: process.cwd(),
            output: 'output'
        };
        Object.defineProperties(this, {
            options: {
                value: extend({}, defaultOpts, opts),
                writable: false,
                configurable: false,
                enumerable: true
            },
            fileCollectionGroup: {
                value: [],
                writable: false,
                configurable: false,
                enumerable: true
            },
            streams: {
                value: [],
                writable: false,
                configurable: false,
                enumerable: true
            },
            restStreamIdx: {
                value: -1,
                writable: true,
                configurable: false,
                enumerable: true
            }
        });
        Object.freeze(this.options);
        if (isFunction(taskRun)) {
            taskRun(this);
        }
    }
    build() {
        return this._getFiles().then(filenames => {
            return this._group(filenames);
        }).then(() => {
            return this._walkStream();
        });
    }
    pick(pattern) {
        if (!pattern || !isString(pattern)) {
            throw new Error(`A string pattern is required to pick up some files`);
        }
        const stream = new Stream(null, pattern);
        stream.on('end', leaf => {
            this.streams.push(leaf);
        });
        return stream;
    }
    rest() {
        const restStream = new Stream(null, null);
        restStream.on('end', leaf => {
            this.streams.push(leaf);
        });
        return restStream;
    }
    _getFiles() {
        return new Promise((resolve, reject) => {
            glob('**/*.*', {
                cwd: this.options.cwd
            }, (err, filenames) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(filenames);
                }
            });
        });
    }
    watch() {
        const {
            cwd,
            output
        } = this.options;
        info(`Watching ${cwd}...`);
        const watcher = chokidar.watch(`${cwd}/**/*`, {
            ignored: [`${output}/**/*`, /[\/\\]\./],
            persistent: true,
            ignoreInitial: true,
            cwd: cwd
        });
        watcher.on('add', path => {
                info(`File ${path} has been added`);
                this._onWatchFiles({
                    filename: path,
                    cmd: 'add'
                });
            })
            .on('change', path => {
                info(`File ${path} has been changed`);
                this._onWatchFiles({
                    filename: path,
                    cmd: 'change'
                });
            })
            .on('unlink', path => {
                info(`File ${path} has been removed`);
                this._onWatchFiles({
                    filename: path,
                    cmd: 'remove'
                });
            });

    }
    _walkStream(diffs) {
        return new Promise((resolve, reject) => {
            let ret = [];
            const startTime = process.hrtime();
            let startStreamIdx = 0;
            const walkStream = () => {
                if (startStreamIdx === this.streams.length) {
                    const diff = process.hrtime(startTime);
                    const millseconds = parseInt(diff[0] * 1e3 + diff[1] / 1e6, 10);
                    info(`Complete in ${millseconds}ms`);
                    resolve(ret);
                } else {
                    const stream = this.streams[startStreamIdx];
                    stream.flow(this.fileCollectionGroup[startStreamIdx].values(), diffs).then(data => {
                        ret.push(data);
                        walkStream();
                    }).catch(reject);
                }
                startStreamIdx += 1;
            };
            walkStream();
        });
    }
    _onWatchFiles(...diffs) {

        for (let i = 0; i < diffs.length; ++i) {
            let matched = false;

            for (let j = 0; j < this.streams.length; ++j) {
                if (this.streams[j].match(diffs[i].filename)) {
                    matched = true;

                    this.fileCollectionGroup[j].update(diffs[i]);
                }
            }

            if (!matched && this.restStreamIdx >= 0) {
                this.fileCollectionGroup[this.restStreamIdx].update(diffs[i]);
            }
        }
        return this._walkStream(diffs);
    }
    _group(filenames) {
        const group = this.fileCollectionGroup;

        // Initialize group
        for (let k = 0; k < this.streams.length; ++k) {
            group[k] = new FileCollection();
        }

        const leftGroup = new FileCollection();

        for (let i = 0; i < filenames.length; ++i) {
            let filename = filenames[i];
            let matched = false;

            this.streams.forEach((stream, idx) => {
                if (!stream.pattern) {
                    this.restStreamIdx = idx;
                } else if (stream.match(filename)) {
                    matched = true;
                    group[idx].add(new File(filename));
                }
            });

            if (!matched) {
                leftGroup.add(new File(filename));
            }
        }

        if (this.restStreamIdx >= 0) {
            group[this.restStreamIdx] = leftGroup;
        }

    }
}

module.exports = Panto;