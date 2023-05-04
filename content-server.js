var express = require('express'),
    app = express(),
    Q = require('q'),
    _ = require('underscore'),
    expressHandlebars = require('express-handlebars'),
    helpers = require('./lib/extensions/helpers.js');

/*
 * Services
 */
var LogService = require('./lib/services/log-service'),
    FirebaseService = require('./lib/services/firebase-service'),
    SearchService = require('./lib/services/search-service'),
    ConfigService = require('./lib/services/config-service'),
    RedisService = require('./lib/services/redis-service'),
    EmailService = require('./lib/services/email-service'),
    ThemeService = require('./lib/services/theme-service'),
    WordService = require('./lib/services/word-service');

/*
 * Controllers
 */
var CacheController = require('./lib/controllers/cache'),
    EnvironmentController = require('./lib/controllers/environment'),
    FeedController = require('./lib/controllers/feed'),
    ProductController = require('./lib/controllers/product'),
    PageController = require('./lib/controllers/page'),
    EmailController = require('./lib/controllers/email'),
    ResourceController = require('./lib/controllers/resource'),
    StaticController = require('./lib/controllers/static');

if (ConfigService.get('public.environment') === 'production') {
    var NewRelic = require('newrelic');
    console.log('...enabling New Relic');
}

/*
 * Templating
 */
app.set('view engine', 'handlebars');

/*
 * Redis
 */
app.use(CacheController.pages);

/*
 * Env.js
 */
app.get('/env.js', EnvironmentController.envJS);

/*
 * Static
 */
app.use('/static', StaticController.content);

app.use('/favicon.ico', StaticController.file('favicon.ico'));
app.use('/robots.txt', StaticController.file('robots.txt'));
app.use('/sitemap.xml', StaticController.sitemap);

/*
 * Atom 1.0 and RSS 2.0
 */
app.get('/atom', FeedController.atom);
app.get('/rss', FeedController.rss);

/*
 * Product
 */
app.get('/products', ProductController.products);
app.get('/products/:hashtag', ProductController.hashtag);
app.get('/product/:slug', ProductController.product);

/*
 * Resource
 */
app.get('/resource/:key', ResourceController.resource);


/*
 * Posts
 */
app.get('/', PageController.frontPage);

app.get('/blog', PageController.frontPage);


app.get('/posts/:page', PageController.posts);

app.get('/:slug', PageController.page);

app.get('/search/:searchTerm', PageController.search);

/*
 * Email
 */

app.get('/transaction/:key/email/:type', EmailController.transaction);
app.get('/user/:userId/assignment/:assignmentKey/feedback-email/:type', EmailController.feedbackEmail);

/*
 * Auth & App Listen
 */
console.log('...Starting auth...');
FirebaseService.isAuthenticated().then(function() {
    console.log('...authenticated...');
    console.log('...warming redis cache...');
    var deferred = Q.defer();

    Q.all([
            ThemeService.setTheme(),
            RedisService.setWords(),
            RedisService.setProducts(),
            RedisService.setSettings(),
            RedisService.setHashtags()
        ])
        .spread(function(theme, words, products, settings, hashtags) {
            var viewsDir;

            if (!theme) {
                theme = {
                    active: 'quiver',
                    options: {
                        quiver: 'quiver'
                    }
                }
            }

            theme.active = theme.options[theme.active || Object.keys(theme.options)[0]];

            viewsDir = './themes/' + theme.active + '/views';

            handlebars = expressHandlebars.create({
                defaultLayout: 'main',
                layoutsDir: viewsDir + '/layouts',
                partialsDir: viewsDir + '/partials',
                helpers: helpers
            });

            app.engine('html', handlebars.engine);
            app.engine('handlebars', handlebars.engine);

            app.set('views', viewsDir);

            WordService.setApp(app);
            EmailService.setApp(app);
            ProductController.setApp(app);
            PageController.setApp(app);

            SearchService.createIndex(words, function(err, result) {
                return err ? deferred.reject(err) : deferred.resolve(result);
            });

        });

    deferred.promise.then(function() {
        var port = ConfigService.get('private.content.port');
        app.listen(port);

        if (NewRelic) {
            LogService.info('New Relic enabled for production');
            app.locals.NewRelic = NewRelic.getBrowserTimingHeader();
        } else {
            LogService.info('New Relic disabled for development');
            app.locals.NewRelic = "<script>console.warn('New Relic timings header not inserted.');</script>";
        }

        LogService.info('Serving on port ' + port);

    }, function(err) {
        LogService.error('App not listening', err);
    });

});