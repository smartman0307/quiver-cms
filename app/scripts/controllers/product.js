'use strict';

/**
 * @ngdoc function
 * @name quiverCmsApp.controller:ProductCtrl
 * @description
 * # ProductCtrl
 * Controller of the quiverCmsApp
 */
angular.module('quiverCmsApp')
    .controller('ProductCtrl', function($scope, $q, product, productImages, productOptionGroups, productOptionsMatrix, files, hashtags, productHashtags, NotificationService, ClipboardService, CommerceService, $localStorage, env, $filter, $timeout, Slug, _) {

        /*
         * Product
         */
        var checkValidity = function() {
            $timeout(function() {
                var product = $scope.product,
                    invalidate = function() {
                        $scope.product.isValid = false;
                    },
                    validate = function() {
                        $scope.product.isValid = true;
                    },
                    valid = true;

                if (typeof product.slug !== 'string' || !product.slug.length || typeof product.price !== 'number') {
                    valid = false;
                }

                if (valid && product.shipped) {
                    if (!product.shipping || typeof product.shipping.domesticBase !== 'number' || typeof product.shipping.internationalBase !== 'number') {
                        valid = false;
                    }

                    if (!product.shipping || typeof product.shipping.domesticIncremental !== 'number' || typeof product.shipping.internationalIncremental !== 'number') {
                        valid = false;
                    }
                }

                if (valid) {
                    switch ($scope.product.type) {
                        case 'physical':

                            break;

                        case 'digital':
                            if (typeof product.downloadUri !== 'string' || !product.downloadUri.length) {
                                valid = false;
                            }
                            break;

                        case 'subscription':
                            if (typeof product.subscriptionDays !== 'number') {
                                valid = false;
                            }
                            if (!product.subscriptionType || !~['content', 'interaction'].indexOf(product.subscriptionType)) {
                                product.subscriptionType = 'content';
                            }
                            break;

                        case 'gift':
                            if (typeof product.discount !== 'number') {
                                valid = false;
                            }
                            break;
                        default:
                            valid = false;
                            break;
                    }

                }

                return valid ? validate() : invalidate();

            });

        };

        $scope.checkValidity = _.debounce(checkValidity, 500);

        product.$bindTo($scope, 'product');

        product.$loaded().then(function() {
            if (!$scope.product.description) {
                $scope.product.description = {};
            }

            if (!$scope.product.description.markdown) {
                $scope.product.description.markdown = "### Let's add a [CommonMark](http://commonmark.org) product description!";
            }

            $scope.$watch('product', checkValidity);
        });

        $scope.slugify = _.debounce(function() {
            $scope.product.slug = Slug.slugify($scope.product.slug);
        }, 500);

        /*
         * Product Images
         */
        $scope.productImages = productImages;

        /*
         * Product Options Matrix
         */
        productOptionsMatrix.$bindTo($scope, 'productOptionsMatrix');

        var updateMatrix = function(optionGroups) {
            var slugs = [],
                i = 0,
                length = optionGroups.length,
                matrix = {},
                group;

            for (i; i < length; i++) {
                group = optionGroups[i];

                if (i === 0) {
                    _.each(group.options, function(option) {
                        var slug = option.slug;

                        if (length === 1) { // Add the final slug if this is the only loop
                            slugs.push(slug);
                        }

                        if (!matrix[slug]) {
                            matrix[slug] = {};
                        }
                        matrix[slug].name = option.name;
                        matrix[slug].slug = option.slug;
                        matrix[slug].shipped = option.shipped || false;
                        matrix[slug].priceDifference = option.priceDifference || 0;

                    });


                } else {
                    _.each(matrix, function(matrixItem, key) {
                        if (key.charAt(0) !== '$') {
                            _.each(group.options, function(option, index) {
                                var slug = key + '|' + option.slug;

                                if (i === length - 1) {
                                    slugs.push(slug); // Add to final list
                                } else {
                                    delete matrix[key]; // Clean up mess
                                }

                                if (!matrix[slug]) {
                                    matrix[slug] = {};
                                }
                                matrix[slug].name = matrixItem.name + ' + ' + option.name;
                                matrix[slug].slug = key + '|' + option.slug;
                                matrix[slug].shipped = option.shipped || false;
                                matrix[slug].priceDifference = matrixItem.priceDifference + (option.priceDifference || 0);

                            });
                        }

                    });

                }

            }


            // Pruning... and updating in place
            var keys = _.uniq(Object.keys(matrix).concat(Object.keys($scope.productOptionsMatrix))),
                j = keys.length;

            while (j--) {
                if (!~slugs.indexOf(keys[j])) {
                    delete matrix[keys[j]];
                    delete $scope.productOptionsMatrix[keys[j]];
                } else {
                    if (!$scope.productOptionsMatrix[keys[j]]) {
                        $scope.productOptionsMatrix[keys[j]] = {};
                    }
                    $scope.productOptionsMatrix[keys[j]].name = matrix[keys[j]].name;
                    $scope.productOptionsMatrix[keys[j]].slug = matrix[keys[j]].slug;
                    $scope.productOptionsMatrix[keys[j]].shipped = matrix[keys[j]].shipped;
                    $scope.productOptionsMatrix[keys[j]].priceDifference = matrix[keys[j]].priceDifference;
                    $scope.productOptionsMatrix[keys[j]].inStock = typeof $scope.productOptionsMatrix[keys[j]].inventory !== 'number' || $scope.productOptionsMatrix[keys[j]].inventory > 0;
                }

            }

        };

        $scope.updateMatrix = updateMatrix;

        $scope.usingMatrix = function() {
            if ($scope.productOptionsMatrix) {
                var keys = Object.keys($scope.productOptionsMatrix),
                    i = keys.length;

                while (i--) {
                    if (keys[i].charAt(0) !== '$') {
                        return true;
                    }
                }
            }

            return false;
        };


        /*
         * Product Option Groups
         */
        $scope.productOptionGroups = productOptionGroups;

        $scope.addOptionGroup = function() {
            $scope.productOptionGroups.$add({
                name: ""
            });
        };

        $scope.removeOptionGroup = function(group) {
            $scope.productOptionGroups.$remove(group).then(function() {
                updateMatrix($scope.productOptionGroups);
            });

        };

        $scope.addOption = function(group, optionName) {
            var option = {
                    name: optionName,
                    slug: Slug.slugify(optionName)
                },
                key = $scope.productOptionGroups.$keyAt(group),
                index = $scope.productOptionGroups.$indexFor(key);

            if (!group.options) {
                group.options = [];
            }

            group.options.push(option);

            $scope.productOptionGroups[index] = group;
            $scope.productOptionGroups.$save(index).then(function() {
                updateMatrix($scope.productOptionGroups);
            });



        }

        $scope.removeOption = function(group, option) {
            var key = $scope.productOptionGroups.$keyAt(group),
                index = $scope.productOptionGroups.$indexFor(key),
                i = group.options.length;

            while (i--) {
                if (group.options[i].slug === option.slug) {
                    group.options.splice(i, 1);
                }
            }

            $scope.productOptionGroups[index] = group;
            $scope.productOptionGroups.$save(index).then(function() {
                updateMatrix($scope.productOptionGroups);
            });


        };

        $scope.saveOption = function(group) {
            var key = $scope.productOptionGroups.$keyAt(group),
                index = $scope.productOptionGroups.$indexFor(key);

            $scope.productOptionGroups[index] = group;
            $scope.productOptionGroups.$save(index).then(function() {
                updateMatrix($scope.productOptionGroups);
            });
        };

        /*
         * localStorage
         */
        $scope.$storage = $localStorage;

        /*
         * Files
         */
        $scope.files = files;

        $scope.makeFeaturedImage = function(file) {
            $scope.product.featuredImage = file;
        };

        $scope.removeFromClipboard = function(file) {
            var fileName = $filter('filename')(file.Key);

            if (ClipboardService.remove(file, $scope)) {
                return NotificationService.success('- Clipboard', fileName + ' has been removed from the clipboard.');
            } else {
                return NotificationService.error('Not Found', fileName + ' was not found in the clipboard');
            }

        };

        $scope.addFromClipboard = function(file) {
            $scope.productImages.$add(file);
        };

        $scope.removeImage = function(file) {
            $scope.productImages.$remove(file);
        };

        /*
         * Hashtags
         */
        $scope.hashtags = hashtags;
        $scope.productHashtags = _.toArray(productHashtags);
        $scope.searchText = null;
        $scope.selectedHashtag = null;

        $scope.searchHashtags = function(searchText) {
            return _.filter($scope.hashtags, function(hashtag) {
                return !!hashtag.key.match(new RegExp(searchText, 'i')) && !_.findWhere(productHashtags, {
                    key: hashtag.key
                });
            });

        };

        $scope.addHashtag = function(chip) {
            var promise;

            if (typeof chip === 'string' && !_.findWhere(productHashtags, {
                    key: chip.toLowerCase()
                })) {
                promise = productHashtags.$add({
                    key: Slug.slugify(chip),
                    value: chip
                });

            } else if (typeof chip === 'object' && !_.findWhere(productHashtags, {
                    key: chip.key
                })) {
                promise = productHashtags.$add({
                    key: chip.key,
                    value: chip.value
                });

            }

            if (promise) {
                promise.then(function() {
                    NotificationService.success('Hashtag added', chip.key || chip);
                }, function(err) {
                    NotificationService.error('Hashtag failed', chip.key || chip + ' ' + err);
                });
            }

        };

        $scope.$watch('productHashtags', function() {
            var i = productHashtags.length,
                deletePromises = [],
                dupePromises = [],
                deferred = $q.defer();

            while (i--) {
                if (!_.findWhere($scope.productHashtags, {
                        key: productHashtags[i].key
                    })) {
                    deletePromises.push(productHashtags.$remove(productHashtags[i]));
                }
            }

            $q.all(deletePromises).then(function() {
                var grouped = _.groupBy(productHashtags, function(hashtag) {
                    return hashtag.key;
                });
                _.each(grouped, function(group) {
                    var j = group.length - 1;
                    while (j--) {
                        dupePromises.push(productHashtags.$remove(productHashtags.$indexFor(group[j].$id)));
                    }
                });

                $q.all(dupePromises).then(deferred.resolve, deferred.reject);

            });

            return deferred.promise;

        }, true);

        productHashtags.$watch(function(e) {
            $scope.productHashtags = _.toArray(productHashtags);
        });

        /*
         * Shipping
         */
        $scope.isShipped = CommerceService.isShipped;

    });