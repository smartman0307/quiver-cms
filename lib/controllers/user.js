var	ConfigService = require('../services/config-service'),
	LogService = require('../services/log-service'),
	Firebase = require('firebase'),

	firebaseEndpoint = ConfigService.get('public.firebase.endpoint');

module.exports = {
	hydrateUser: function (req, res, next) {
		if (req.method === 'OPTIONS') {
	    	return next();
	  	}

		var userToken = req.headers.authorization,
			userId = req.headers['user-id'],
			userRef = new Firebase(firebaseEndpoint + '/users/' + userId),
			handleAuthError = function (err) {
			  LogService.log('userRef auth', err);
			  return res.status(401).send({'error': 'Not authorized. userId and authorization headers must be present and valid.'});
			};

		if (!userToken) {
			return res.sendStatus(403);
		}

		userRef.authWithCustomToken(userToken, function (err, currentUser) {
			if (err) {
				return handleAuthError(err);
			} else {
			  	req.userRef = userRef;
			  	userRef.once('value', function (snapshot) {
			    	var user = snapshot.val();

				    req.user = user;

				    if (!user || !user.public || !user.private) { // Create a user if necessary
				      userRef.set({
				        'public': {
				          id: currentUser.auth.uid
				        },
				        'private': {
				          isAdmin: false
				        }
				      }, function (err) {
				        if (err) {
				          return handleAuthError(err);
				        } else {
				          userRef.once('value', function (snapshot) {
				            req.user = snapshot.val();
				            next();
				          });

				        }
				      });

				    } else {
				      next();
				    }

			  	});
			}

		});	
	},

	get: function (req, res) {
		if (req.user.public.id === req.params.userId) {
	    res.json(req.user);
	  } else {
	    res.sendStatus(403);
	  }
	}

};