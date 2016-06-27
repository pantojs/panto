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
            assert.ok('_parent' in s);
            assert.ok('_pattern' in s);
            assert.ok('_transformer' in s);
            assert.equal(s._transformer, undefined);
            assert.ok('_cacheFiles' in s);
            assert.throws(() => {
                s._parent = 1;
            });
            assert.throws(() => {
                delete s._parent;
            });
            assert.throws(() => {
                s._pattern = 1;
            });
            assert.throws(() => {
                delete s._pattern;
            });
            assert.throws(() => {
                s._transformer = 1;
            });
            assert.throws(() => {
                delete s._transformer;
            });
            assert.throws(() => {
                s._cacheFiles = 1;
            });
            assert.throws(() => {
                delete s._cacheFiles;
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
            assert.ok(s === rs._parent);
        });

        it('should pass own pattern', () => {
            const s = new Stream();
            const rs = s.pipe(new Transformer());
            assert.ok(s._pattern === rs._pattern);
        });

        it('should pass the transformer', () => {
            const s = new Stream();
            const tr = new Transformer();
            const rs = s.pipe(tr);
            assert.ok(tr, rs._transformer);
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
    describe('#flow', () => {
        it('should return origin if transformer is null', done => {
            const s = new Stream().end();
            s._matchFiles.add({
                filename: 'a.js'
            });
            s.flow().then(flattenDeep).then(files => {
                assert.deepEqual(files[0].filename, 'a.js');
                done();
            });
        });
        it('transform using own transformer if no parent', done => {
            const s = new Stream(null, '', new TestTransformer()).end();
            s._matchFiles.add({
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
            const s = new Stream(null, '', new TestTransformer()).end();

            const s1 = s.pipe(new TestTransformer()).pipe(new TestTransformer()).end();
            s1._matchFiles.add({
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
            const s = new Stream(null, '', new MultiplyTransformer()).end();
            s._matchFiles.add({
                filename: 'a.js',
                content: 'a'
            });
            s.flow().then(files => {
                assert.deepEqual(files[0].content, 'a');
                assert.deepEqual(files[1].content, 'aa');
                done();
            });
        });
        it('should support null/undefined/[]', done => {
            class EmptyTransformer extends Transformer {
                _transform() {
                    return Promise.resolve(this.options.data);
                }
            }
            const s = new Stream().pipe(new EmptyTransformer({
                data: undefined
            })).pipe(new EmptyTransformer({
                data: []
            })).pipe(new EmptyTransformer({
                data: null
            })).end();

            s._matchFiles.add({
                filename: 'a.js',
                content: 'a'
            });

            s.flow().then(files => {
                assert.deepEqual(files, []);
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
            })).end();
            s2._matchFiles.add({
                filename: 'a.js'
            });
            s2.flow().then(args => {
                assert.deepEqual(args[0].n, '123');
            }).then(() => {
                const s3 = s1.pipe(new AppendTransformer({
                    n: 4
                })).end();

                s3._matchFiles.add({
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
    describe('#fix', () => {
        it('should does nothing to rest stream', () => {
            const s = new Stream(null, null).end('rest');
            s._matchFiles.add({
                filename: 'a.js',
                content: 'a'
            });

            s.fix({
                cmd: 'change',
                filename: 'a.js'
            });
            assert.ok(s._matchFiles.has('a.js'),
                'fixing does nothing to rest stream if not forced');
            s.fix({
                cmd: 'change',
                filename: 'a.js'
            }, true);
            assert.deepEqual(s._matchFiles.get('a.js').content, null,
                'content is null after forcing fix');
        });
        it('should clear cache', done => {
            const s = new Stream(null, '*.js', new TestTransformer());
            const s1 = s.pipe(new TestTransformer());
            const s2 = s1.pipe(new TestTransformer()).end('s2');

            s2._matchFiles.add({
                filename: 'a.js',
                content: 'a'
            });

            s2.flow().then(() => {
                assert.deepEqual(s2._matchFiles.get('a.js').content, 'aaaaaaaa',
                    'set content to "aaaaaaaa"');
                assert.ok(s._cacheFiles.has('a.js'), 'cached in s');
                assert.ok(s1._cacheFiles.has('a.js'), 'cached in s1');
                assert.ok(s2._cacheFiles.has('a.js'), 'cached in s2');

                s2.fix({
                    cmd: 'change',
                    filename: 'a.js'
                });

                assert.deepEqual(s2._matchFiles.get('a.js').content, null,
                    'set content to null');
                assert.ok(!s2._cacheFiles.has('a.js'), 'clear cache in s2');
                assert.ok(!s1._cacheFiles.has('a.js'), 'clear cache in s1');
                assert.ok(!s._cacheFiles.has('a.js'), 'clear cache in s');

            }).then(() => {
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