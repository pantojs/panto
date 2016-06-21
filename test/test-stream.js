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
const Transformer = require('../src/transformer');
const File = require('../src/file');
const flattenDeep = require('lodash/flattenDeep');

/*global describe,it*/
class TestTransformer extends Transformer {
    _transform(file) {
        const {
            content
        } = file;
        return new Promise(resolve => {
            resolve(file.update(content + content));
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
                file.clone(),
                file.clone().update(content + content)
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
            const rs = s.pipe(new Transformer());
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
            s.flow([new File('a.js')]).then(flattenDeep).then(files => {
                assert.deepEqual(files[0].filename, 'a.js');
                done();
            });
        });
        it('transform using own transformer if no parent', done => {
            const s = new Stream(null, '', new TestTransformer());
            s.flow([new File('a.js', 'a')]).then((...files) => {
                const args = flattenDeep(files);
                assert.ok(Array.isArray(args));
                assert.ok(args[0].content, 'aa');
            }).then(() => {
                done();
            });
        });
        it('transform to the ancestor', done => {
            const s = new Stream(null, '', new TestTransformer());
            s.pipe(new TestTransformer()).pipe(new TestTransformer()).flow([new File('a.js',
                'a')]).then((...files) => {
                const args = flattenDeep(files);
                assert.ok(Array.isArray(args));
                assert.ok(args[0].content, 'aaaaaaaa');
            }).then(() => {
                done();
            });
        });
        it('should get multiple files', done => {
            const s = new Stream(null, '', new MultiplyTransformer());
            s.flow([new File('a.js', 'a')]).then(files => {
                assert.deepEqual(files[0].content, 'a');
                assert.deepEqual(files[1].content, 'aa');
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