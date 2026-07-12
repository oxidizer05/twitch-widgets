const gulp = require("gulp");
const rimraf = require("rimraf"); // для удаления файлов/папок
const sass = require("gulp-sass")(require("sass"));
const browserSync = require("browser-sync").create();
const postcss = require("gulp-postcss");
const autoprefixer = require("autoprefixer"); // автоматически добавляет вендорные префиксы к CSS свойствам (req .browserslistrc)
const cssvariables = require("postcss-css-variables");
const calc = require("postcss-calc");
const sourcemaps = require("gulp-sourcemaps"); // указывает src файл js/css для инспектора браузров
const concat = require("gulp-concat");
const uncss = require("@raz1el/uncss").postcssPlugin; // убирает неиспользуемые css классы
// minify js/css
const uglify = require("gulp-uglify-es").default; // сжатие js es6 кода
const cleanCSS = require("gulp-clean-css"); // сжатие CSS кода
const imagemin = require("gulp-imagemin");
const htmlmin = require("gulp-htmlmin");
// Node module support
const browserify = require("browserify");
const source = require("vinyl-source-stream");
const buffer = require("vinyl-buffer");
const merge = require("merge-stream");
// Helpers
const path = require("path");
const fs = require("fs");
const glob = require("glob-promise");
// config
const cfg = JSON.parse(require("fs").readFileSync("./package.json", { encoding: "utf8" }));

gulp.task("build:css", () => {
    return cssBuild(true);
});

gulp.task("build-dev:css", () => {
    return cssBuild(false);
});

gulp.task("build:js", () => {
    return jsBuild(true);
});

gulp.task("build:img", () => {
    return gulp.src(cfg.gulp.src.img + "/*")
        .pipe(imagemin({
            verbose: true
        }))
        .pipe(gulp.dest(cfg.gulp.build.img));
});

gulp.task("build:font", () => {
    return gulp.src(cfg.gulp.src.font + "/*")
        .pipe(gulp.dest(cfg.gulp.build.font));
});

gulp.task("build:html", () => {
    return gulp.src(cfg.gulp.src.html + "/*.html")
        .pipe(htmlmin({
            collapseWhitespace: true,
            removeComments: true,
        }))
        .pipe(gulp.dest(cfg.gulp.build.html));
});

gulp.task("clean", () => {
    return new Promise((resolve, reject) => {
        rimraf(cfg.gulp.build.root, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

gulp.task("build", gulp.series(["clean", "build:css", "build:js", "build:img", "build:html", "build:font"]));
gulp.task("build-dev", gulp.series(["clean", "build-dev:css", "build:js", "build:img", "build:html", "build:font"]));

gulp.task("browserSync", gulp.series((done) => {
    browserSync.init({
        watch: true,
        server: cfg.gulp.build.root
        // notify: false
    });
    done();
}));

gulp.task("watch-nosync", gulp.series(["build"], () => {
    gulp.watch(cfg.gulp.src.css, gulp.series(["build:css"]));
    gulp.watch(cfg.gulp.src.js, gulp.series(["build:js"]));
    gulp.watch(cfg.gulp.src.img, gulp.series(["build:img"]));
    gulp.watch(cfg.gulp.src.html, gulp.series(["build:html"]));
    gulp.watch(cfg.gulp.src.html, gulp.series(["build:font"]));
}));

gulp.task("watch", gulp.series(["build", "browserSync"], () => {
    gulp.watch(cfg.gulp.src.css, gulp.series(["build:css"]));
    gulp.watch(cfg.gulp.src.js, gulp.series(["build:js"]));
    gulp.watch(cfg.gulp.src.img, gulp.series(["build:img"]));
    gulp.watch(cfg.gulp.src.html, gulp.series(["build:html"]));
    gulp.watch(cfg.gulp.src.html, gulp.series(["build:font"]));
}));

gulp.task("watch-dev", gulp.series(["build-dev", "browserSync"], () => {
    gulp.watch(cfg.gulp.src.css, gulp.series(["build-dev:css"]));
    gulp.watch(cfg.gulp.src.js, gulp.series(["build:js"]));
    gulp.watch(cfg.gulp.src.img, gulp.series(["build:img"]));
    gulp.watch(cfg.gulp.src.html, gulp.series(["build:html"]));
    gulp.watch(cfg.gulp.src.html, gulp.series(["build:font"]));
}));

function cssBuild(production) {
    let uncssIgnore;
    if (cfg.gulp.css.uncss.enable) {
        uncssIgnore = getJsSelectors();
        console.log("Uncss ignore", uncssIgnore);
    }
    const src = cfg.gulp.src.css + (cfg.gulp.css.sass.enable ? "/*.{scss,css}" : "/*.css");
    // Файлы считываются рекурсивно в root директории scss. На выходе получается один файл стилей
    if (cfg.gulp.css.merge) {
        return cssCallback({
            src,
            name: cfg.gulp.css.mergeName,
            production,
            uncssIgnore
        });
    }
    else { // Файлы считываются только в root директории scss. На выходе получается несколько файлов стилей
        const files = glob.sync(src);
        return merge(files.map(file => {
            return cssCallback({
                src: file,
                name: path.basename(file).replace(cfg.gulp.css.sass.enable ? /(.scss|.css)$/ : /.css$/, ""),
                production,
                uncssIgnore
            });
        }));
    }
}

function cssCallback(config) {
    let stream = gulp.src(config.src).pipe(concat(config.name + (cfg.gulp.css.clean.enable ? ".min.css" : ".css")));

    if (cfg.gulp.css.sass.enable) {
        if (config.production)
            stream = stream.pipe(sass(cfg.gulp.css.sass.opts).on("error", sass.logError));
        else
            stream = stream.pipe(sass({
                outputStyle: "expanded"
            }).on("error", sass.logError));
    }

    if (cfg.gulp.css.sourcemaps)
        stream = stream.pipe(sourcemaps.init());

    const plugins = [];

    if (cfg.gulp.css.uncss.enable)
        plugins.push(uncss({
            html: [cfg.gulp.src.html + "/*.html"],
            ignore: config.uncssIgnore,
            ignoreJs: [],
            jsdom: {
                runScripts: "outside-only"
            }
        }));

    if (cfg.gulp.css.autoprefixer.enable)
        plugins.push(autoprefixer(cfg.gulp.css.cssvariables.opts));

    if (cfg.gulp.css.cssvariables.enable)
        plugins.push(cssvariables(cfg.gulp.css.cssvariables.opts));

    if (cfg.gulp.css.calc.enable)
        plugins.push(calc(cfg.gulp.css.calc.opts));

    stream = stream.pipe(postcss(plugins));

    if (cfg.gulp.css.clean.enable)
        stream = stream.pipe(cleanCSS());

    if (cfg.gulp.css.sourcemaps)
        stream = stream.pipe(sourcemaps.write("./maps"));

    return stream.pipe(gulp.dest(cfg.gulp.build.css));
}

// TODO: make browserify as config option
function jsBuild() {
    if (cfg.gulp.js.merge) {
        let stream = gulp.src(cfg.gulp.src.js + "/*.js").pipe(concat(cfg.gulp.js.mergeName + (cfg.gulp.js.uglify.enable ? ".min.js" : ".js")));

        if (cfg.gulp.js.sourcemaps)
            stream = stream.pipe(sourcemaps.init({ loadMaps: true }));

        if (cfg.gulp.js.uglify.enable)
            stream = stream.pipe(uglify(cfg.gulp.js.uglify.opts));

        if (cfg.gulp.js.sourcemaps)
            stream = stream.pipe(sourcemaps.write("./maps"));

        return stream.pipe(gulp.dest(cfg.gulp.build.js));
    }
    else {
        // https://stackoverflow.com/questions/41043032/browserify-parseerror-import-and-export-may-appear-only-with-sourcetype
        const files = glob.sync(cfg.gulp.src.js + "/*.js");
        return merge(files.map(file => {
            // /\.min\./.test(file) ? path.basename(file) : 
            let stream = browserify({
                entries: [file],
                debug: true
            }).bundle()
                .pipe(source(path.basename(file).replace(/(.js)$/, "") + (cfg.gulp.js.uglify.enable ? ".min.js" : ".js")))
                .pipe(buffer());

            if (cfg.gulp.js.sourcemaps)
                stream = stream.pipe(sourcemaps.init({ loadMaps: true }));

            if (cfg.gulp.js.uglify.enable)
                stream = stream.pipe(uglify(cfg.gulp.js.uglify.opts));

            if (cfg.gulp.js.sourcemaps)
                stream = stream.pipe(sourcemaps.write("./maps"));

            return stream.pipe(gulp.dest(cfg.gulp.build.js));
        }));
    }
}

// uncss
function getJsSelectors() {
    const selectors = [];
    const files = glob.sync(cfg.gulp.src.js + "/**/*.js");

    for (const file of files) {
        const script = fs.readFileSync(file, "utf8");
        const regexClass = script.match(/classList\.add\((["'][\w|-]*["'])\)/gm);

        if (regexClass) {
            for (const str of regexClass) {
                const match = str.match(/classList\.add\((["'][\w|-]*["'])\)/);

                if (match && match[1])
                    selectors.push(...match[1].replace(/["']+/g, "").split(",").map(s => "." + s.trim()));
            }
        }
        const regexElem = script.match(/createElement\((["'][\w|-]*["'])\)/gm);

        if (regexElem) {
            for (const str of regexElem) {
                const match = str.match(/createElement\((["'][\w|-]*["'])\)/);

                if (match && match[1])
                    selectors.push(match[1].replace(/["']+/g, ""));
            }
        }
    }
    if (cfg.gulp.css.uncss.enable)
        selectors.push(...cfg.gulp.css.uncss.opts.ignore);
    return [...new Set(selectors)];
}
