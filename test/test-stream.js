/**
 * Copyright (C) 2016 pantojs.xyz
 * test-stream.js
 *
 * changelog
 * 2016-06-21[19:28:12]:revised
 *
 * @author yanni4night@gmail.com
 * @version 1.0.0
 * @since 1.0.0
 */
'use strict';
const assert = require('assert');
const Stream = require('../src/stream');
const Transformer = require('panto-transformer');
const flattenDeep = require('lodash/flattenDeep');
const extend = require('lodash/extend');

/*global describe,it*/
class TestTransformer extends Transformer {
    _transform(file) {
        const {
            content
        } = file;
        return new Promise(resolve => {
            resolve(extend(file, {
                content: content + content
            }));
        });
    }
}

class MultiplyTransformer extends Transformer {
    _transform(file) {
        const {
            content
        } = file;
        return new Promise(resolve => {
            resolve([
                extend({}, file),
                extend({}, file, {
                    content: content + content
                })
            ]);
        });
    }
}

describe('stream', () => {
    describe('#constructor', () => {
        it('should define sealed parent,pattern,transformer,cacheFiles,resourceMap', () => {
            const s = new Stream();
            assert.ok('parent' in s);
            assert.ok('pattern' in s);
            assert.ok('transformer' in s);
            assert.equal(s.transformer, undefined);
            assert.ok('cacheFiles' in s);
            assert.throws(() => {
                s.parent = 1;
            });
            assert.throws(() => {
                delete s.parent;
            });
            assert.throws(() => {
                s.pattern = 1;
            });
            assert.throws(() => {
                delete s.pattern;
            });
            assert.throws(() => {
                s.transformer = 1;
            });
            assert.throws(() => {
                delete s.transformer;
            });
            assert.throws(() => {
                s.cacheFiles = 1;
            });
            assert.throws(() => {
                delete s.cacheFiles;
            });
        });
    });
    describe('#pipe', () => {
        it('should get another stream returned', () => {
            const s = new Stream();
            const rs = s.pipe(new Transformer());
            assert.ok(s !== rs);
            assert.ok(rs instanceof Stream);
        });

        it('should pass this as the parent', () => {
            const s = new Stream();
            const rs = s.pipe(new Transformer());
            assert.ok(s === rs.parent);
        });

        it('should pass own pattern', () => {
            const s = new Stream();
            const rs = s.pipe(new Transformer());
            assert.ok(s.pattern === rs.pattern);
        });

        it('should pass the transformer', () => {
            const s = new Stream();
            const tr = new Transformer();
            const rs = s.pipe(tr);
            assert.ok(tr, rs.transformer);
        });

        it('bubble up "end" event', done => {
            const s = new Stream();
            const rs = s.pipe(new Transformer()).pipe(new Transformer());
            s.on('end', () => {
                done();
            });
            rs.emit('end');
        });
    });
    describe('#match', () => {
        it('should match the file', () => {
            const s = new Stream(null, '*.jpg');
            assert.ok(s.match('a.jpg'));
        });
    });
    describe('#flow', () => {
        it('should return origin if transformer is null', done => {
            const s = new Stream();
            s.matchFiles.add({
                filename: 'a.js'
            });
            s.flow().then(flattenDeep).then(files => {
                assert.deepEqual(files[0].filename, 'a.js');
                done();
            });
        });
        it('transform using own transformer if no parent', done => {
            const s = new Stream(null, '', new TestTransformer());
            s.matchFiles.add({
                filename: 'a.js',
                content: 'a'
            });
            s.flow().then((...files) => {
                const args = flattenDeep(files);
                assert.ok(Array.isArray(args));
                assert.ok(args[0].content, 'aa');
            }).then(() => {
                done();
            });
        });
        it('transform to the ancestor', done => {
            const s = new Stream(null, '', new TestTransformer());

            const s1 = s.pipe(new TestTransformer()).pipe(new TestTransformer());
            s1.matchFiles.add({
                filename: 'a.js',
                content: 'a'
            });
            s1.flow().then((...files) => {
                const args = flattenDeep(files);
                assert.ok(Array.isArray(args));
                assert.ok(args[0].content, 'aaaaaaaa');
            }).then(() => {
                done();
            });
        });
        it('should get multiple files', done => {
            const s = new Stream(null, '', new MultiplyTransformer());
            s.matchFiles.add({
                filename: 'a.js',
                content: 'a'
            });
            s.flow().then(files => {
                assert.deepEqual(files[0].content, 'a');
                assert.deepEqual(files[1].content, 'aa');
                done();
            });
        });
        it('should support furcal&cache', done => {
            let total = 0;
            class OneTransformer extends Transformer {
                _transform(file) {
                    ++total;
                    return Promise.resolve(extend(file, {
                        n: '1'
                    }));
                }
            }
            class AppendTransformer extends Transformer {
                _transform(file) {
                    return Promise.resolve(extend(file, {
                        n: file.n + '' + this.options.n
                    }));
                }
            }
            const s = new Stream(null, '', new OneTransformer());
            const s1 = s.pipe(new AppendTransformer({
                n: 2
            }));
            const s2 = s1.pipe(new AppendTransformer({
                n: 3
            }));
            s2.matchFiles.add({
                filename: 'a.js'
            });
            s2.flow().then(args => {
                assert.deepEqual(args[0].n, '123');
            }).then(() => {
                const s3 = s1.pipe(new AppendTransformer({
                    n: 4
                }));

                s3.matchFiles.add({
                    filename: 'a.js'
                });

                return s3.flow();
            }).then(args => {
                assert.deepEqual(args[0].n, '124');
                assert.deepEqual(total, 1, 'stream caches');
                done();
            });
        });
    });
    describe('#end', () => {
        it('should set the tag', () => {
            const s = new Stream();
            s.end('kate');
            assert.deepEqual(s.tag, 'kate');
        });
        it('should emit "end" event', done => {
            const s = new Stream();
            s.on('end', () => {
                done();
            });
            s.end();
        });
        it('should emit "end" event to th ancestor', done => {
            const s = new Stream(null, '', new TestTransformer());
            const last = s.pipe(new TestTransformer()).pipe(new TestTransformer());
            s.on('end', leaf => {
                assert.deepEqual(leaf, last);
                done();
            });
            last.end();
        });
    });
});