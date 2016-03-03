var gulp = require('gulp');
var gutil = require('gulp-util');
var sequence = require('run-sequence');
var glob = require('glob');
var es = require('event-stream');
var del = require('del');
var typescript = require('../index');
var tsc = require('../lib/tsc');
var expectFile = require('gulp-expect-file');

var expect = function (files) {
  return expectFile({ checkRealFile: true, errorOnFailure: true, verbose: true }, files);
};

var abort  = function (err) { throw err; };
var ignore = function (err) { };
var currentVersion = 'INVALID';

var isVersionGte150 = function (version) {
    return version.indexOf('1.5.') === 0;
}

gulp.task('default', ['version', 'all']);

gulp.task('version', function (cb) {
    tsc.version(function (err, data) {
        if (err) throw err;
        currentVersion = data;
        cb();
    });
});

gulp.task('clean', ['version'], function (cb) {
    del([
        'build/**',
        'src-inplace/**/*.js',
    ]).then(cb, null);
});

gulp.task('all', ['clean'], function (cb) {
  var tasks = Object.keys(this.tasks).filter(function (k) { return /^test\d+/.test(k) });
  tasks.sort(function (a, b) { return a.match(/\d+/)[0] - b.match(/\d+/)[0] });
  tasks.push(cb);
  sequence.apply(null, tasks);
});

// Compiling single file
gulp.task('test1', ['clean'], function () {
  return gulp.src('src/foo.ts')
    .pipe(typescript()).on('error', abort)
    .pipe(gulp.dest('build/test1'))
    .pipe(expect('build/test1/foo.js'));
});

// Compiling multiple files
gulp.task('test2', ['clean'], function () {
    console.log(expect([
      'build/test2/foo.js',
      'build/test2/sum.js',
      'build/test2/calc.js'
    ]));
  return gulp.src('src/*.ts')
    .pipe(typescript()).on('error', abort)
    .pipe(gulp.dest('build/test2'))
    .pipe(expect([
      'build/test2/foo.js',
      'build/test2/sum.js',
      'build/test2/calc.js'
    ]));
});

// Compiling multiple files keeping directory structure
gulp.task('test3', ['clean'], function () {
  return gulp.src('src/**/*.ts')
    .pipe(typescript()).on('error', abort)
    .pipe(gulp.dest('build/test3'))
    .pipe(expect([
      'build/test3/foo.js',
      'build/test3/sum.js',
      'build/test3/calc.js',
      'build/test3/s1/a.js',
      'build/test3/s2/b.js'
    ]));
});

// Compiling multiple files into one file
gulp.task('test4', ['clean'], function () {
  return gulp.src('src/*.ts')
    .pipe(typescript({ out: 'test4.js' })).on('error', abort)
    .pipe(gulp.dest('build/test4'))
    .pipe(expect('build/test4/test4.js'));
});

// Compiling fails and outputs nothing
gulp.task('test5', ['clean'], function () {
  return gulp.src('src-broken/error.ts')
    .pipe(typescript()).on('error', ignore)
    .pipe(gulp.dest('build/test5'))
    .pipe(!isVersionGte150(currentVersion)
          ? expect([]) : expect(['build/test5/error.js'])
         );
});

// Compiling warns some errors but outputs a file
gulp.task('test6', ['clean'], function () {
  return gulp.src('src-broken/warning.ts')
    .pipe(typescript()).on('error', ignore)
    .pipe(gulp.dest('build/test6'))
    .pipe(expect('build/test6/warning.js'));
});

// Compiling files including .d.ts file
gulp.task('test7', ['clean'], function () {
  return gulp.src(['src-d/*.ts'])
    .pipe(typescript()).on('error', abort)
    .pipe(gulp.dest('build/test7'))
    .pipe(expect([
      'build/test7/main.js',
      'build/test7/sub.js'
    ]))
});

// Compiling files including .d.ts file into one
gulp.task('test8', ['clean'], function () {
  return gulp.src('src-d/*.ts')
    .pipe(typescript({ out: 'unified.js' })).on('error', abort)
    .pipe(gulp.dest('build/test8'))
    .pipe(expect('build/test8/unified.js'))
});

// Compiling .d.ts file only
gulp.task('test9', ['clean'], function () {
  return gulp.src('src-d/hello.d.ts')
    .pipe(typescript()).on('error', abort)
    .pipe(gulp.dest('build/test9'))
    .pipe(expect([]))
});

// Compiling cross-project files
gulp.task('test10', ['clean'], function () {
  return gulp.src('src-crossproj/proj-a/main.ts')
    .pipe(typescript()).on('error', abort)
    .pipe(gulp.dest('build/test10'))
    .pipe(expect([
      'build/test10/proj-a/main.js',
      'build/test10/proj-b/util.js',
      'build/test10/proj-b/sub/sub.js',
    ]))
});

// Compiling with sourcemap
gulp.task('test11', ['clean'], function () {
  return gulp.src('src/foo.ts')
    .pipe(typescript({ sourcemap: true })).on('error', abort)
    .pipe(gulp.dest('build/test11'))
    .pipe(expect({
      'build/test11/foo.js':     true,
      'build/test11/foo.js.map': '"sources":["../src/foo.ts"]'
    }))
});

// Compiling sourcemap files
gulp.task('test12', ['clean'], function () {
  return gulp.src('src-crossproj/proj-a/main.ts')
    .pipe(typescript({ sourcemap: true, outDir: 'build/test12' })).on('error', abort)
    .pipe(gulp.dest('build/test12'))
    .pipe(expect({
      'build/test12/proj-a/main.js':        true,
      'build/test12/proj-a/main.js.map':    '"sources":["../../../src-crossproj/proj-a/main.ts"]',
      'build/test12/proj-b/util.js':        true,
      'build/test12/proj-b/util.js.map':    '"sources":["../../../src-crossproj/proj-b/util.ts"]',
      'build/test12/proj-b/sub/sub.js':     true,
      'build/test12/proj-b/sub/sub.js.map': '"sources":["../../../../src-crossproj/proj-b/sub/sub.ts"]'
    }))
});

// Compiling sourcemap files into one file
gulp.task('test13', ['clean'], function () {
  return gulp.src('src-crossproj/proj-a/main.ts')
    .pipe(typescript({ sourcemap: true, sourceRoot: '/', out: 'unified.js' })).on('error', abort)
    .pipe(gulp.dest('build/test13'))
    .pipe(expect({
      'build/test13/unified.js':     true,
      'build/test13/unified.js.map': [
        '"sourceRoot":"/"',
        /"sources":\[("(proj-b\/util\.ts|proj-b\/sub\/sub\.ts|proj-a\/main\.ts)",?){3}\]/
      ]
    }))
});

// Compiling into source directory (in-place)
gulp.task('test14', ['clean'], function () {
  return gulp.src('src-inplace/**/*.ts')
    .pipe(typescript()).on('error', abort)
    .pipe(gulp.dest('src-inplace'))
    .pipe(expect([
      'src-inplace/top1.js',
      'src-inplace/top2.js',
      'src-inplace/sub/sub1.js',
      'src-inplace/sub/sub2.js',
    ]))
});

// emitError: false
gulp.task('test15', ['clean'], function () {
  return gulp.src('src-broken/error.ts')
    .pipe(typescript({ emitError: false }))
    .pipe(gulp.dest('build/test15'))
    .pipe(!isVersionGte150(currentVersion)
          ? expect([]) : expect(['build/test15/error.js'])
         );
});

// Compile two project in one task
gulp.task('test16', ['clean'], function () {
  var ps = es.pause();

  var one = gulp.src('src/s1/*.ts')
    .pipe(ps.pause())  // Pausing stream for 1 sec
    .pipe(typescript()).on('error', abort)
    .pipe(gulp.dest('build/test16/s1'));

  var two = gulp.src('src/s2/*.ts')
    .pipe(typescript()).on('error', abort)
    .pipe(gulp.dest('build/test16/s2'));

  setTimeout(function () { ps.resume() }, 1000);

  return es.merge(one, two)
    .pipe(expect([
      'build/test16/s1/a.js',
      'build/test16/s2/b.js'
    ]))
    .on('end', function () {
      if (glob.sync('gulp-tsc-tmp-*').length > 0) {
        throw "Temporary directory is left behind";
      }
    });
});

// Compile two project in one task with errors
gulp.task('test17', ['clean'], function () {
  var one = gulp.src('src-broken/error.ts')
    .pipe(typescript()).on('error', ignore)
    .pipe(gulp.dest('build/test17/s1'));

  var two = gulp.src('src/s2/*.ts')
    .pipe(typescript()).on('error', ignore)
    .pipe(gulp.dest('build/test17/s2'));

  return es.merge(one, two)
    .pipe(!isVersionGte150(currentVersion)
          ? expect(['build/test17/s2/b.js'])
          : expect(['build/test17/s1/error.js', 'build/test17/s2/b.js'])
         )
    .on('end', function () {
      if (glob.sync('gulp-tsc-tmp-*').length > 0) {
        throw "Temporary directory is left behind";
      }
    });
});

// Compile files in nested directory
gulp.task('test18', ['clean'], function () {
  return gulp.src('src-inplace/*/*.ts')
    .pipe(typescript({ sourcemap: true, outDir: 'build/test18' })).on('error', abort)
    .pipe(gulp.dest('build/test18'))
    .pipe(expect({
      'build/test18/sub/sub1.js':     true,
      'build/test18/sub/sub1.js.map': '"sources":["../../../src-inplace/sub/sub1.ts"]',
      'build/test18/sub/sub2.js':     true,
      'build/test18/sub/sub2.js.map': '"sources":["../../../src-inplace/sub/sub2.ts"]'
    }))
});

// Compile files in nested directory into one file
gulp.task('test19', ['clean'], function () {
  return gulp.src('src-inplace/*/*.ts')
    .pipe(typescript({ sourcemap: true, outDir: 'build/test19', out: 'test19.js' })).on('error', abort)
    .pipe(gulp.dest('build/test19'))
    .pipe(expect({
      'build/test19/test19.js':     true,
      'build/test19/test19.js.map': /"sources":\[("..\/..\/src-inplace\/sub\/sub[12].ts",?){2,3}\]/
    }))
});

// for https://github.com/kotas/gulp-tsc/issues/21
gulp.task('test20', ['clean'], function () {
  return gulp.src('src-crossproj/*-a/*.ts')
    .pipe(typescript({ outDir: 'build/test20' })).on('error', abort)
    .pipe(gulp.dest('build/test20'))
    .pipe(expect([
      'build/test20/proj-a/main.js',
      'build/test20/proj-b/util.js',
      'build/test20/proj-b/sub/sub.js'
    ]));
});

// Compiling files with pathFilter
gulp.task('test21', ['clean'], function () {
  return gulp.src('src-crossproj/proj-a/*.ts')
    .pipe(typescript({
      sourcemap: true,
      outDir: 'build/test21',
      pathFilter: { 'proj-a': 'a/build', 'proj-b': 'b/build' }
    })).on('error', abort)
    .pipe(gulp.dest('build/test21'))
    .pipe(expect({
      'build/test21/a/build/main.js':        true,
      'build/test21/a/build/main.js.map':    '"sources":["../../../../src-crossproj/proj-a/main.ts"]',
      'build/test21/b/build/util.js':        true,
      'build/test21/b/build/util.js.map':    '"sources":["../../../../src-crossproj/proj-b/util.ts"]',
      'build/test21/b/build/sub/sub.js':     true,
      'build/test21/b/build/sub/sub.js.map': '"sources":["../../../../../src-crossproj/proj-b/sub/sub.ts"]'
    }))
});

// Compiling warns some errors and outputs nothing
gulp.task('test22', ['clean'], function () {
  return gulp.src('src-broken/warning.ts')
    .pipe(typescript({ safe: true })).on('error', ignore)
    .pipe(gulp.dest('build/test22'))
    .pipe(expect([]));
});

// Compile two project in one task with warnings
gulp.task('test23', ['clean'], function () {
  var one = gulp.src('src-broken/warning.ts')
    .pipe(typescript({ safe: true })).on('error', ignore)
    .pipe(gulp.dest('build/test23/s1'));

  var two = gulp.src('src/s2/*.ts')
    .pipe(typescript()).on('error', ignore)
    .pipe(gulp.dest('build/test23/s2'));

  return es.merge(one, two)
    .pipe(expect([
      'build/test23/s2/b.js'
    ]))
    .on('end', function () {
      if (glob.sync('gulp-tsc-tmp-*').length > 0) {
        throw "Temporary directory is left behind";
      }
    });
});

// Compile files reference to declarations in outer directory with correct path
// for https://github.com/kotas/gulp-tsc/issues/26
gulp.task('test24', ['clean'], function () {
  return gulp.src('src-d-outer/**/main.ts')
    .pipe(typescript({ declaration: true, outDir: 'build/test24' })).on('error', abort)
    .pipe(gulp.dest('build/test24'))
    .pipe(expect({
      'build/test24/src/main.js':    true,
      'build/test24/src/main.d.ts':  '<reference path="../../../src-d-outer/hello.d.ts" />'
    }))
});
