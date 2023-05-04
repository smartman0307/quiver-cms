'use strict';

angular.module('quiverCmsApp')
  .service('ClipboardService', function ClipboardService($localStorage, _) {
    var inClipboard = function (file) {
      return _.findWhere($localStorage.clipboard, {Key: file.Key});
    };
    
    return {
      inClipboard: inClipboard,
      
      add: function (file) {
        return inClipboard(file) ? false : $localStorage.clipboard.push(file);

      },
      
      remove: function (file) {
        var i = $localStorage.clipboard.length;

        while (i--) {
          if ($localStorage.clipboard[i].Key === file.Key) {
            $localStorage.clipboard.splice(i, 1);
            return true;

          }
        }
        return false;

      }
      
    };
  });
