'use strict';

/**
 * @ngdoc function
 * @name quiverCmsApp.controller:UploadsCtrl
 * @description
 * # UploadsCtrl
 * Controller of the quiverCmsApp
 */
angular.module('quiverCmsApp')
    .controller('UploadsCtrl', function($scope, AdminService, ModeratorService, items) {
        /*
         * Items
         */
        $scope.items = items;

        /*
         * Flags
         */
        $scope.incrementUploadFlag = ModeratorService.incrementUploadFlag;

        /*
         * Uploads
         */
        $scope.save = function(upload) {
            AdminService.getUpload(upload.$id).$loaded().then(function(serverUpload) {
                serverUpload.comment = upload.comment;
                serverUpload.flag = upload.flag;

                if (!serverUpload.comment) {
                    delete serverUpload.comment;
                }

                if (!serverUpload.flag) {
                    delete serverUpload.flag;
                }

                serverUpload.$save();

            });
        };

        $scope.remove = function(upload) {
            AdminService.getUpload(upload.$id).$remove();
        };

        $scope.searchField = 'userEmail';
        $scope.setSearch = function(term) {
            $scope.searchTerm = term;
        };

    });