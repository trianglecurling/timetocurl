var TimeToCurl = (function () {
    function TimeToCurl() {
    }
    TimeToCurl.prototype.init = function () {
        this.setUpEvents();
        var socket = io();
    };
    TimeToCurl.prototype.setUpEvents = function () {
        document.addEventListener("DOMContentLoaded", function () {
        });
    };
    return TimeToCurl;
}());
new TimeToCurl().init();
