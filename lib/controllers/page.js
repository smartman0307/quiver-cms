var ConfigService = require('../services/config-service'),
	LogService = require('../services/log-service'),
	WordService = require('../services/word-service'),
	ObjectService = require('../services/object-service'),
	RedisService = require('../services/redis-service'),
	SearchService = require('../services/search-service'),
	Q = require('q'),
	render;

module.exports = {
	setRender: function (renderFn) {
		render = renderFn;
	},

	frontPage: function (req, res) {
		Q.all([ObjectService.getSettings(), ObjectService.getTheme()]).spread(function (settings, theme) {

			WordService.renderPosts(theme.frontPage || 'front-page', 0, req.url, {title: settings.siteTitle}).then(function (html) {
		    res.status(200).send(html);
		  }, function (err) {
		    res.status(500).send(err);
		  });
			
		});
		
	},

	posts: function (req, res) {
		WordService.renderPosts('posts', req.params.page, req.url).then(function (html) {
	    res.status(200).send(html);
	  }, function (err) {
	    res.status(500).send(err);
	  });
		
	},

	page: function (req, res) {
		Q.all(ObjectService.getSettings(), ObjectService.getWord(req.params.slug)).spread(function (settings, post) {
			render('page', {
	      development: ConfigService.get('public.environment') === 'development',
	      post: post,
	      settings: settings,
	      url: req.url,
	      slug: slug,
	      env: ConfigService.get('public')
	    }, function (err, html) {
	      if (err) {
	        res.status(500).send(err);
	      } else {
	        res.status(200).send(html);
	        RedisService.setPage(req.url, html);

	      }
	    });
			
		}, function (err) {
			LogService.error(404, err);
	    WordService.render404(res, err);
		});
		
	},

	search: function (req, res) {
		var deferred = Q.defer(),
    	searchTerm = req.params.searchTerm;

  	Q.all([ObjectService.getSettings(), SearchService.fullText(searchTerm)]).spread(function (settings, posts) {
  		app.render('posts', {
	      development: ConfigService.get('public.environment') === 'development',
	      title: "Search: " + searchTerm,
	      posts: posts,
	      settings: settings,
	      url: req.url
	    }, function (err, html) {
	      if (err) {
	        res.status(500).send(err);
	      } else {
	        res.status(200).send(html);
	        RedisService.setPage(req.url, html);

	      }
	    });
  		
  	});

	}

};