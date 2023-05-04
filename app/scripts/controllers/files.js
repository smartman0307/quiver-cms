'use strict';

angular.module('quiverCmsApp')
  .controller('FilesCtrl', function ($scope, $q, FileService, NotificationService, bucket, notifications, items, $filter, $localStorage, _, ClipboardService, Slug, env, $interval, AdminService, $stateParams, $mdDialog) {

    /*
     * Items
     */
    $scope.items = items;

    /*
     * localStorage
    */
    $scope.$storage = $localStorage;
    if (!$scope.$storage.clipboard) {
      $scope.$storage.clipboard = [];
    }

    /*
     * Notifications
    */
    $scope.notifications = notifications;

    $scope.getSlug = function (name) {
      var filename = $filter('filename')(name, {'[\\.]': '-'});
      return Slug.slugify(filename);
    };

    $scope.getPercentComplete = function (name) {
      var notification = $scope.notifications[$scope.getSlug(name)];

      return notification ? (notification.loaded / notification.total) / 100 : 0;
    };

    $scope.getNotifications = function (name) {
      return $scope.notifications[$scope.getSlug(name)];
    };

    /*
     * Bucket
     */
    $scope.bucket = bucket.$value;

    /*
     * Query
     */

    $scope.getPrev = function (items) {
      if (items.length) {
        return {orderByChild: 'Index', endAt: (items[0].Index || 0) - 1};  
      } else {
        return 0;
      }
      
    };

    $scope.getNext = function (items) {
      if (items.length) {
        return {orderByChild: 'Index', startAt: (items[items.length - 1].Index || 0) + 1};  
      } else {
        return 10000000000;
      }
      
    };


    /*
     * Files
    */
    $scope.uploadTarget = env.api + '/admin/files';

    $scope.deleteFlowFile = function (flow, file) {
      var i = flow.files.length;

      while (i--) {
        if (file.name === flow.files[i].file.name) {
          flow.files.splice(i, 1);
          return NotificationService.success('File Deleted', file.name + ' was deleted.');

        }
      }

      NotificationService.error('Not Found', file.name + ' was not found.');

    };

    var fakePromises = [];
    $scope.fakeUpload = function (Flow) {
      console.info('Using $scope.fakeUpload. Switch to $scope.upload to make this work for realsies.');

      var i = Flow.files.length,
        handleInterval = function (j) {
          var promise = $interval(function () {
            var percent = Math.round(Flow.files[j].percentComplete || 0);
            Flow.files[j].percentComplete = percent >= 100 ? 0 : percent + 10;
          }, 300);
          fakePromises.push(promise);
        };

      if (!fakePromises.length) {
        while (i--) {
          handleInterval(i);
        }
      } else {
        i = fakePromises.length;
        while (i--) {
          $interval.cancel(fakePromises[i]);
        }
      }
      
    };

    $scope.upload = function (Flow) {
      $scope.uploading = true;

      var promises = [],
        uploadDeferred = $q.defer(),
        resizeDeferred = $q.defer(),
        clearWatches = function () {
          $q.all(promises).then(function (unwatches) {
            _.each(unwatches, function (unwatch) {
              unwatch();
            });
          });
        },
        i = Flow.files.length,
        file;

      while (i--) {
        file = Flow.files[i];

        var fileRef = FileService.getNotification($scope.user.$id, $scope.getSlug(file.name)),
          fileDeferred = $q.defer(),
          fileHandler = function (j, fileDeferred) {
            return function (notification) {
              var unwatch,
                calcPercent = function () {
                  if (Flow.files[j].notification) {
                    var percent = Math.round(100 * (Flow.files[j].notification.loaded / Flow.files[j].notification.total));

                    Flow.files[j].percentComplete = isNaN(percent) ? 0 : percent;
                    if (percent >= 100) { // The .notification object will get erased at this point, so let's leave the percentComplete at 100 and walk away
                      unwatch();
                    }
                  }
                };

              unwatch = notification.$watch(calcPercent);
              calcPercent();

              fileDeferred.resolve(unwatch);
            }


          };

        promises.push(fileDeferred.promise);

        file.notification = fileRef;

        file.notification.$loaded().then(fileHandler(i, fileDeferred));

      }

      $q.all(promises).then(function () {
        var deferred = $q.defer(),
          catchAllHandler = function (e) {
            switch (e) {
              case 'complete':
                $scope.uploading = false; // I know I do this twice, but I wouldn't want it to fail for some reason.
                deferred.resolve(e);
                break;
              case 'error':
                deferred.reject(e);
                break;
              default:
                deferred.notify(e);
                break;
            }
          };

        Flow.upload();
        Flow.on('catchAll', catchAllHandler);

        return deferred.promise;

      }).then(uploadDeferred.resolve, uploadDeferred.reject);

      uploadDeferred.promise.then(function () {
        $scope.resizing = true;
        return FileService.resize();
      }).then(resizeDeferred.resolve, resizeDeferred.reject);

      resizeDeferred.promise.then(function () {
        Flow.files = [];
        $scope.uploading = false; // Just in case the earlier pass at reactivating this button failed.
        $scope.resizing = false;
        clearWatches();
        NotificationService.success('Images Processed', 'Your images have successfully been resized.');

      }, function (err) {
        Flow.files = [];
        $scope.uploading = false;
        $scope.resizing = false;
        clearWatches();
        NotificationService.error('Resize Error', 'Your images have resize failed. ' + err);
        console.warn(err);

      });

    };

    $scope.confirmRemoveFile = function (e, file) {
      var confirm = $mdDialog.confirm()
        .title(file.Key)
        .content('Are you sure you want to destroy me?')
        .ariaLabel('Delete File ' + file.Key)
        .ok('Bye bye file!')
        .cancel("Maybe I'll need you later?")
        .targetEvent(e);

      return $mdDialog.show(confirm).then(function() {
        return $scope.removeFile(file);
      });
    };

    $scope.removeFile = function (file) {
      var parts = file.Key.split("/"),
      fileName;

      parts.shift();
      fileName = parts.join("|");

      if ($scope.inClipboard(file)) {
        $scope.removeFromClipboard(file);
      }

      FileService.remove(fileName || $filter('filename')(file.Key)).then(function () {
        NotificationService.success('File Removed', 'Removed ' + fileName);
      }, function (err) {
        NotificationService.error('File Removal Failed', err);
      });

    };

    $scope.resize = function () {
      var deferred = $q.defer();

      $scope.resizing = true;

      FileService.resize().then(function () {
        NotificationService.success('Images Processed', 'Your images have successfully been resized and the file registry has been updated.');
        delete $scope.resizing;
        deferred.resolve();
      }, function (err) {
        NotificationService.error('Resize Failed', err);
        delete $scope.resizing;
        deferred.reject(err);
      });

      return deferred.promise;

    };

    /*
     * Clipboard
    */
    $scope.inClipboard = ClipboardService.inClipboard;

    $scope.addToClipboard = function (file) {
      var fileName = $filter('filename')(file.Key);

      if (ClipboardService.add(file)) {
//        return NotificationService.success('+ Clipboard', fileName + ' was added to the clipboard.')
        return fileName;
      } else {
//        return NotificationService.error('Already There!', fileName + ' is already in the clipboard.');
        return false;
      }
    };

    $scope.removeFromClipboard = function (file) {
      var deferred = $q.defer(),
        fileName = $filter('filename')(file.Key);

      if (ClipboardService.remove(file)) {
//          NotificationService.success('- Clipboard', fileName + ' has been removed from the clipboard.');
        deferred.resolve(fileName);
      } else {
//          NotificationService.error('Not Found', fileName + ' was not found in the clipboard');
        deferred.reject(fileName);
      }

      return deferred.promise;
    };


  });
